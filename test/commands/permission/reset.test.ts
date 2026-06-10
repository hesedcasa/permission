import {expect} from 'chai'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import PermissionReset from '../../../src/commands/permission/reset.js'
import {readPermissionConfig, writePermissionConfig} from '../../../src/permission-config.js'

function makeReset(argv: string[], configDir: string): {cmd: PermissionReset; output: () => string} {
  const lines: string[] = []
  const config = {
    bin: 'sdkck',
    configDir,
    runHook: async () => ({failures: [], successes: []}),
  } as never
  const cmd = new PermissionReset(argv, config)
  cmd.log = (message = '') => {
    lines.push(String(message))
  }

  return {cmd, output: () => lines.join('\n')}
}

describe('permission reset', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sdkck-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true})
  })

  it('exits early when there are no rules', async () => {
    const {cmd, output} = makeReset(['--confirm'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('No permission rules to reset.')
  })

  it('clears all rules when --confirm is passed', async () => {
    await writePermissionConfig(tmpDir, {
      allowRules: [],
      denyRules: [{pattern: 'jira'}, {pattern: 'mysql'}],
    })

    const {cmd, output} = makeReset(['--confirm'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('Reset to default — all commands allowed.')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.denyRules).to.deep.equal([])
    expect(saved.allowRules).to.deep.equal([{pattern: '*'}])
  })
})
