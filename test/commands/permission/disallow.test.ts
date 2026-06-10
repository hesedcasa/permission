import {expect} from 'chai'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import PermissionDisallow from '../../../src/commands/permission/disallow.js'
import {readPermissionConfig, writePermissionConfig} from '../../../src/permission-config.js'

function makeDisallow(
  argv: string[],
  configDir: string,
  commands: Array<{id: string}> = [],
): {cmd: PermissionDisallow; output: () => string; warnings: () => string} {
  const lines: string[] = []
  const warned: string[] = []
  const config = {
    bin: 'sdkck',
    commands,
    configDir,
    runHook: async () => ({failures: [], successes: []}),
    topicSeparator: ' ',
  } as never
  const cmd = new PermissionDisallow(argv, config)
  cmd.log = (message = '') => {
    lines.push(String(message))
  }

  cmd.warn = (input) => {
    warned.push(String(input))
    return input
  }

  return {cmd, output: () => lines.join('\n'), warnings: () => warned.join('\n')}
}

describe('permission disallow', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sdkck-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true})
  })

  it('adds a disallow rule for the given pattern', async () => {
    const {cmd, output} = makeDisallow(['jira'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('Added disallow rule for "jira".')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.denyRules).to.deep.equal([{pattern: 'jira'}])
  })

  it('keeps other commands allowed when creating the config from scratch', async () => {
    const {cmd} = makeDisallow(['jira'], tmpDir)
    await cmd.run()

    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.deep.equal([{pattern: '*'}])
  })

  it('notes that a rule targeting the permission topic has no effect', async () => {
    const {cmd, output} = makeDisallow(['permission *'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('Added disallow rule for "permission *".')
    expect(output()).to.contain('permission commands are never gated')
  })

  it('does not print the no-effect note for unrelated patterns', async () => {
    const {cmd, output} = makeDisallow(['jira'], tmpDir)
    await cmd.run()

    expect(output()).to.not.contain('never gated')
  })

  it('adds a disallow rule with wildcard pattern', async () => {
    const {cmd} = makeDisallow(['jira *'], tmpDir)
    await cmd.run()

    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.denyRules).to.deep.equal([{pattern: 'jira *'}])
  })

  it('does not duplicate an existing disallow rule', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [], denyRules: [{pattern: 'jira'}]})
    const {cmd, output} = makeDisallow(['jira'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('already in the disallow list')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.denyRules).to.have.length(1)
  })

  it('preserves unrelated rules when adding a new one', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [], denyRules: [{pattern: 'mysql'}]})
    const {cmd} = makeDisallow(['jira'], tmpDir)
    await cmd.run()

    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.denyRules).to.have.length(2)
  })

  it('treats "jira" as a duplicate of "jira *"', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [], denyRules: [{pattern: 'jira *'}]})
    const {cmd, output} = makeDisallow(['jira'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('already covered by "jira *"')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.denyRules).to.have.length(1)
  })

  it('warns when the pattern matches no known command', async () => {
    const {cmd, warnings} = makeDisallow(['jria'], tmpDir, [{id: 'jira:issue'}, {id: 'mysql:query'}])
    await cmd.run()

    expect(warnings()).to.contain('does not match any known command')
  })

  it('does not warn when the pattern matches a known command', async () => {
    const {cmd, warnings} = makeDisallow(['mysql *'], tmpDir, [{id: 'jira:issue'}, {id: 'mysql:query'}])
    await cmd.run()

    expect(warnings()).to.equal('')
  })
})
