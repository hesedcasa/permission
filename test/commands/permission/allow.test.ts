import {expect} from 'chai'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import PermissionAllow from '../../../src/commands/permission/allow.js'
import {readPermissionConfig, writePermissionConfig} from '../../../src/permission-config.js'

function makeAllow(argv: string[], configDir: string): {cmd: PermissionAllow; output: () => string} {
  const lines: string[] = []
  const config = {
    bin: 'sdkck',
    configDir,
    runHook: async () => ({failures: [], successes: []}),
  } as never
  const cmd = new PermissionAllow(argv, config)
  cmd.log = (message = '') => {
    lines.push(String(message))
  }

  return {cmd, output: () => lines.join('\n')}
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
    const saved = await readPermissionConfig(tmpDir)
    expect(saved.allowRules).to.deep.equal([{pattern: 'jira'}])
    expect(saved.rules).to.deep.equal([])
  })

  it('adds an allow rule with wildcard pattern', async () => {
    const {cmd} = makeAllow(['jira *'], tmpDir)
    await cmd.run()

    const saved = await readPermissionConfig(tmpDir)
    expect(saved.allowRules).to.deep.equal([{pattern: 'jira *'}])
  })

  it('does not duplicate an existing allow rule', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'jira'}], rules: []})
    const {cmd, output} = makeAllow(['jira'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('already in the allow list')
    const saved = await readPermissionConfig(tmpDir)
    expect(saved.allowRules).to.have.length(1)
  })

  it('preserves unrelated allow rules when adding a new one', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'mysql'}], rules: []})
    const {cmd} = makeAllow(['jira'], tmpDir)
    await cmd.run()

    const saved = await readPermissionConfig(tmpDir)
    expect(saved.allowRules).to.have.length(2)
  })

  it('preserves existing disallow rules when adding an allow rule', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [], rules: [{pattern: 'mysql'}]})
    const {cmd} = makeAllow(['jira'], tmpDir)
    await cmd.run()

    const saved = await readPermissionConfig(tmpDir)
    expect(saved.rules).to.deep.equal([{pattern: 'mysql'}])
    expect(saved.allowRules).to.deep.equal([{pattern: 'jira'}])
  })
})
