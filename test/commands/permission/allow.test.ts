import {expect} from 'chai'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import PermissionAllow from '../../../src/commands/permission/allow.js'
import {readPermissionConfig, writePermissionConfig} from '../../../src/permission-config.js'

function makeAllow(
  argv: string[],
  configDir: string,
  commands: Array<{id: string}> = [],
): {cmd: PermissionAllow; output: () => string; warnings: () => string} {
  const lines: string[] = []
  const warned: string[] = []
  const config = {
    bin: 'sdkck',
    commands,
    configDir,
    runHook: async () => ({failures: [], successes: []}),
    topicSeparator: ' ',
  } as never
  const cmd = new PermissionAllow(argv, config)
  cmd.log = (message = '') => {
    lines.push(String(message))
  }

  cmd.warn = (input) => {
    warned.push(String(input))
    return input
  }

  return {cmd, output: () => lines.join('\n'), warnings: () => warned.join('\n')}
}

describe('permission allow', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sdkck-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true})
  })

  it('adds an allow rule for the given pattern', async () => {
    const {cmd, output} = makeAllow(['jira'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('Added allow rule for "jira".')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.deep.equal([{pattern: 'jira'}])
    expect(saved.denyRules).to.deep.equal([])
  })

  it('adds an allow rule with wildcard pattern', async () => {
    const {cmd} = makeAllow(['jira *'], tmpDir)
    await cmd.run()

    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.deep.equal([{pattern: 'jira *'}])
  })

  it('does not duplicate an existing allow rule', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'jira'}], denyRules: []})
    const {cmd, output} = makeAllow(['jira'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('already in the allow list')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.have.length(1)
  })

  it('preserves unrelated allow rules when adding a new one', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'mysql'}], denyRules: []})
    const {cmd} = makeAllow(['jira'], tmpDir)
    await cmd.run()

    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.have.length(2)
  })

  it('preserves existing disallow rules when adding an allow rule', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [], denyRules: [{pattern: 'mysql'}]})
    const {cmd} = makeAllow(['jira'], tmpDir)
    await cmd.run()

    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.denyRules).to.deep.equal([{pattern: 'mysql'}])
    expect(saved.allowRules).to.deep.equal([{pattern: 'jira'}])
  })

  it('treats "jira *" as a duplicate of "jira"', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'jira'}], denyRules: []})
    const {cmd, output} = makeAllow(['jira *'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('already covered by "jira"')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.have.length(1)
  })

  it('warns when the pattern matches no known command', async () => {
    const {cmd, warnings} = makeAllow(['jria *'], tmpDir, [{id: 'jira:issue'}, {id: 'mysql:query'}])
    await cmd.run()

    expect(warnings()).to.contain('does not match any known command')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.deep.equal([{pattern: 'jria *'}])
  })

  it('does not warn when the pattern matches a known command', async () => {
    const {cmd, warnings} = makeAllow(['jira'], tmpDir, [{id: 'jira:issue'}, {id: 'mysql:query'}])
    await cmd.run()

    expect(warnings()).to.equal('')
  })
})
