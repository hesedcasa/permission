import {expect} from 'chai'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import PermissionList from '../../../src/commands/permission/list.js'
import {writePermissionConfig} from '../../../src/permission-config.js'

function makeList(configDir: string): {cmd: PermissionList; output: () => string} {
  const lines: string[] = []
  const config = {
    bin: 'sdkck',
    configDir,
    runHook: async () => ({failures: [], successes: []}),
  } as never
  const cmd = new PermissionList([], config)
  cmd.log = (message = '') => {
    lines.push(String(message))
  }

  return {cmd, output: () => lines.join('\n')}
}

describe('permission list', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sdkck-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true})
  })

  it('reports allow-all default when no config file exists', async () => {
    const {cmd, output} = makeList(tmpDir)
    await cmd.run()

    expect(output()).to.contain('No rules configured — all commands allowed (default).')
  })

  it('reports default deny when the config exists but has no rules', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [], denyRules: []})
    const {cmd, output} = makeList(tmpDir)
    await cmd.run()

    expect(output()).to.contain('all commands blocked (default deny')
  })

  it('returns the config for --json consumers', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'jira'}], denyRules: [{pattern: 'mysql'}]})
    const {cmd} = makeList(tmpDir)
    const result = await cmd.run()

    expect(result.config).to.deep.equal({allowRules: [{pattern: 'jira'}], denyRules: [{pattern: 'mysql'}]})
  })

  it('lists disallow rules', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [], denyRules: [{pattern: 'mysql *'}]})
    const {cmd, output} = makeList(tmpDir)
    await cmd.run()

    expect(output()).to.contain('disallow')
    expect(output()).to.contain('mysql *')
  })

  it('shows the rule count', async () => {
    await writePermissionConfig(tmpDir, {
      allowRules: [],
      denyRules: [{pattern: 'jira'}, {pattern: 'mysql'}],
    })
    const {cmd, output} = makeList(tmpDir)
    await cmd.run()

    expect(output()).to.contain('2 rules')
  })

  it('shows singular "rule" for a single entry', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [], denyRules: [{pattern: '*'}]})
    const {cmd, output} = makeList(tmpDir)
    await cmd.run()

    expect(output()).to.contain('1 rule')
    expect(output()).to.not.contain('1 rules')
  })
})
