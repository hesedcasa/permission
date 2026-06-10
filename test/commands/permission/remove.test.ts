import {expect} from 'chai'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import PermissionRemove from '../../../src/commands/permission/remove.js'
import {readPermissionConfig, writePermissionConfig} from '../../../src/permission-config.js'

function makeRemove(argv: string[], configDir: string): {cmd: PermissionRemove; output: () => string} {
  const lines: string[] = []
  const config = {
    bin: 'sdkck',
    configDir,
    runHook: async () => ({failures: [], successes: []}),
  } as never
  const cmd = new PermissionRemove(argv, config)
  cmd.log = (message = '') => {
    lines.push(String(message))
  }

  return {cmd, output: () => lines.join('\n')}
}

describe('permission remove', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sdkck-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true})
  })

  it('removes an allow rule', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'permission *'}, {pattern: 'jira'}], denyRules: []})
    const {cmd, output} = makeRemove(['jira'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('Removed allow rule "jira".')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.deep.equal([{pattern: 'permission *'}])
  })

  it('removes a disallow rule', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: '*'}], denyRules: [{pattern: 'jira'}]})
    const {cmd, output} = makeRemove(['jira'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('Removed disallow rule "jira".')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.denyRules).to.deep.equal([])
  })

  it('removes the pattern from both lists when present in both', async () => {
    await writePermissionConfig(tmpDir, {
      allowRules: [{pattern: '*'}, {pattern: 'jira'}],
      denyRules: [{pattern: 'jira'}],
    })
    const {cmd, output} = makeRemove(['jira'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('Removed allow rule "jira".')
    expect(output()).to.contain('Removed disallow rule "jira".')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.deep.equal([{pattern: '*'}])
    expect(saved.denyRules).to.deep.equal([])
  })

  it('only removes from the allow list with --allow', async () => {
    await writePermissionConfig(tmpDir, {
      allowRules: [{pattern: '*'}, {pattern: 'jira'}],
      denyRules: [{pattern: 'jira'}],
    })
    const {cmd} = makeRemove(['jira', '--allow'], tmpDir)
    await cmd.run()

    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.deep.equal([{pattern: '*'}])
    expect(saved.denyRules).to.deep.equal([{pattern: 'jira'}])
  })

  it('only removes from the disallow list with --disallow', async () => {
    await writePermissionConfig(tmpDir, {
      allowRules: [{pattern: '*'}, {pattern: 'jira'}],
      denyRules: [{pattern: 'jira'}],
    })
    const {cmd} = makeRemove(['jira', '--disallow'], tmpDir)
    await cmd.run()

    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.deep.equal([{pattern: '*'}, {pattern: 'jira'}])
    expect(saved.denyRules).to.deep.equal([])
  })

  it('reports when the pattern is not found', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: '*'}], denyRules: []})
    const {cmd, output} = makeRemove(['jira'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('was not found in the permission list')
  })

  it('does not create a config file when nothing is removed', async () => {
    const {cmd} = makeRemove(['jira'], tmpDir)
    await cmd.run()

    expect(await readPermissionConfig(tmpDir)).to.equal(null)
  })

  it('removes "jira *" when asked to remove "jira"', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'jira *'}, {pattern: 'mysql'}], denyRules: []})
    const {cmd, output} = makeRemove(['jira'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('Removed allow rule "jira *".')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.deep.equal([{pattern: 'mysql'}])
  })
})
