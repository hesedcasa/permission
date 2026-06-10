import {Errors} from '@oclif/core'
import {expect} from 'chai'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import hook from '../../../src/hooks/prerun/check-permission.js'
import {writePermissionConfig} from '../../../src/permission-config.js'

type HookOpts = Parameters<typeof hook>[0]

function makeOpts(configDir: string, commandId: string, topicSeparator = ' '): HookOpts {
  return {
    argv: [],
    Command: {id: commandId} as HookOpts['Command'],
    config: {configDir, topicSeparator} as unknown as HookOpts['config'],
    context: {} as HookOpts['context'],
  }
}

describe('prerun/check-permission hook', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sdkck-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true})
  })

  it('does nothing when no rules are configured', async () => {
    const opts = makeOpts(tmpDir, 'jira issue')
    await hook.call({} as never, opts) // should not throw
  })

  it('does nothing when no rule matches (default allow)', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: '*'}], denyRules: [{pattern: 'mysql'}]})
    const opts = makeOpts(tmpDir, 'jira issue')
    await hook.call({} as never, opts) // should not throw
  })

  it('throws CLIError when a command matches a disallow rule', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: '*'}], denyRules: [{pattern: 'mysql'}]})
    const opts = makeOpts(tmpDir, 'mysql query')
    try {
      await hook.call({} as never, opts)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Errors.CLIError)
      expect((error as Errors.CLIError).message).to.contain('"mysql query"')
    }
  })

  it('throws for a command matching a wildcard disallow rule', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: '*'}], denyRules: [{pattern: 'jira *'}]})
    const opts = makeOpts(tmpDir, 'jira issue create')
    try {
      await hook.call({} as never, opts)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Errors.CLIError)
    }
  })

  it('throws when disallow * blocks all commands', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: '*'}], denyRules: [{pattern: '*'}]})
    const opts = makeOpts(tmpDir, 'mysql query')
    try {
      await hook.call({} as never, opts)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Errors.CLIError)
    }
  })

  it('blocks a colon-separated command ID (as stored by external plugins)', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: '*'}], denyRules: [{pattern: 'jira'}]})
    const opts = makeOpts(tmpDir, 'jira:issue:assign')
    try {
      await hook.call({} as never, opts)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Errors.CLIError)
      expect((error as Errors.CLIError).message).to.contain('"jira issue assign"')
    }
  })

  it('allows a command matching an allow rule when no disallow rules exist', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'jira'}], denyRules: []})
    const opts = makeOpts(tmpDir, 'jira issue')
    await hook.call({} as never, opts) // should not throw
  })

  it('blocks a command not matching any allow rule', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'jira'}], denyRules: []})
    const opts = makeOpts(tmpDir, 'mysql query')
    try {
      await hook.call({} as never, opts)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Errors.CLIError)
      expect((error as Errors.CLIError).message).to.contain('"mysql query"')
    }
  })

  it('blocks a command that is in the allow list but also matched by a disallow rule', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'jira'}], denyRules: [{pattern: 'jira'}]})
    const opts = makeOpts(tmpDir, 'jira issue')
    try {
      await hook.call({} as never, opts)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Errors.CLIError)
    }
  })

  it('throws (instead of allowing everything) when the config file is corrupted', async () => {
    await writeFile(join(tmpDir, 'permission.json'), '{not valid json', 'utf8')
    const opts = makeOpts(tmpDir, 'jira issue')
    try {
      await hook.call({} as never, opts)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      expect((error as Error).message).to.contain('not valid JSON')
    }
  })

  it('blocks all commands when both rule lists are empty (default deny)', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [], denyRules: []})
    const opts = makeOpts(tmpDir, 'jira issue')
    try {
      await hook.call({} as never, opts)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Errors.CLIError)
    }
  })

  it('never blocks permission commands, even when everything is disallowed', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [], denyRules: [{pattern: '*'}]})
    await hook.call({} as never, makeOpts(tmpDir, 'permission allow')) // should not throw
    await hook.call({} as never, makeOpts(tmpDir, 'permission reset')) // should not throw
  })

  it('never blocks colon-separated permission command ids', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [], denyRules: [{pattern: '*'}]})
    await hook.call({} as never, makeOpts(tmpDir, 'permission:allow')) // should not throw
  })
})
