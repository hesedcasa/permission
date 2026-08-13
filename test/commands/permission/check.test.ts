import {expect} from 'chai'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'

import PermissionCheck from '../../../src/commands/permission/check.js'
import {writePermissionConfig} from '../../../src/permission-config.js'

function makeCheck(argv: string[], configDir: string): {cmd: PermissionCheck; output: () => string} {
  const lines: string[] = []
  const config = {
    bin: 'sdkck',
    configDir,
    runHook: async () => ({failures: [], successes: []}),
  } as never
  const cmd = new PermissionCheck(argv, config)
  cmd.log = (message = '') => {
    lines.push(String(message))
  }

  return {cmd, output: () => lines.join('\n')}
}

async function runExpectingExit(cmd: PermissionCheck): Promise<number | undefined> {
  try {
    await cmd.run()
    return undefined
  } catch (error) {
    return (error as {oclif?: {exit?: number}}).oclif?.exit
  }
}

describe('permission check', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'sdkck-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true})
  })

  it('reports allow-all default when no config exists', async () => {
    const {cmd, output} = makeCheck(['jira'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('is allowed')
    expect(output()).to.contain('no permission config exists')
  })

  it('reports the allow rule that permits a command', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'jira'}], denyRules: []})
    const {cmd, output} = makeCheck(['jira issue create'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('✓ "jira issue create" is allowed by allow rule "jira".')
  })

  it('reports the disallow rule that blocks a command and exits 1', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: '*'}], denyRules: [{pattern: 'jira *'}]})
    const {cmd, output} = makeCheck(['jira issue create'], tmpDir)
    const exitCode = await runExpectingExit(cmd)

    expect(output()).to.contain('✗ "jira issue create" is blocked by disallow rule "jira *".')
    expect(exitCode).to.equal(1)
  })

  it('reports default deny when no allow rule matches and exits 1', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'mysql'}], denyRules: []})
    const {cmd, output} = makeCheck(['jira'], tmpDir)
    const exitCode = await runExpectingExit(cmd)

    expect(output()).to.contain('✗ "jira" is blocked — no allow rule matches it (default deny).')
    expect(exitCode).to.equal(1)
  })

  it('reports permission commands as never gated', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [], denyRules: [{pattern: '*'}]})
    const {cmd, output} = makeCheck(['permission allow'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('✓ "permission allow" is always allowed — permission commands are never gated.')
  })

  it('accepts unquoted multi-word commands', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'jira *'}], denyRules: []})
    const {cmd, output} = makeCheck(['jira', 'issue', 'create'], tmpDir)
    await cmd.run()

    expect(output()).to.contain('✓ "jira issue create" is allowed by allow rule "jira *".')
  })
})
