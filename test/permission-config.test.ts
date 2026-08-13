import {expect} from 'chai'
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {
  canonicalPattern,
  explainCommandDecision,
  isCommandAllowed,
  isPermissionCommand,
  readPermissionConfig,
  writePermissionConfig,
} from '../src/permission-config.js'

describe('permission config', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'sdkck-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true})
  })

  it('defaults legacy configs without allowRules to allow all commands', async () => {
    await writeFile(path.join(tmpDir, 'permission.json'), JSON.stringify({rules: [{pattern: 'mysql'}]}), 'utf8')

    const config = (await readPermissionConfig(tmpDir))!

    expect(config.allowRules).to.deep.equal([{pattern: '*'}])
    expect(config.denyRules).to.deep.equal([{pattern: 'mysql'}])
    expect(isCommandAllowed('jira', config)).to.equal(true)
    expect(isCommandAllowed('mysql', config)).to.equal(false)
  })

  it('reads legacy configs with an explicit empty allowRules list', async () => {
    await writeFile(path.join(tmpDir, 'permission.json'), JSON.stringify({allowRules: [], rules: []}), 'utf8')

    const config = (await readPermissionConfig(tmpDir))!

    expect(config.allowRules).to.deep.equal([])
    expect(isCommandAllowed('jira', config)).to.equal(false)
  })

  it('round-trips a config through write and read with a version stamp', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [{pattern: 'jira'}], denyRules: [{pattern: 'mysql'}]})

    const raw = JSON.parse(await readFile(path.join(tmpDir, 'permission.json'), 'utf8'))
    expect(raw.version).to.equal(1)

    const config = (await readPermissionConfig(tmpDir))!
    expect(config).to.deep.equal({allowRules: [{pattern: 'jira'}], denyRules: [{pattern: 'mysql'}]})
  })

  it('does not apply the legacy allow-all default to versioned configs', async () => {
    await writeFile(path.join(tmpDir, 'permission.json'), JSON.stringify({denyRules: [], version: 1}), 'utf8')

    const config = (await readPermissionConfig(tmpDir))!

    expect(config.allowRules).to.deep.equal([])
  })

  it('throws when the config version is newer than supported', async () => {
    await writeFile(
      path.join(tmpDir, 'permission.json'),
      JSON.stringify({allowRules: [], denyRules: [], version: 99}),
      'utf8',
    )

    try {
      await readPermissionConfig(tmpDir)
      expect.fail('should have thrown')
    } catch (error) {
      expect((error as Error).message).to.contain('version 99')
    }
  })

  describe('canonicalPattern', () => {
    it('treats "jira *" and "jira" as the same pattern', () => {
      expect(canonicalPattern('jira *')).to.equal(canonicalPattern('jira'))
    })

    it('keeps "*" as-is', () => {
      expect(canonicalPattern('*')).to.equal('*')
    })

    it('does not change exact patterns', () => {
      expect(canonicalPattern('jira issue create')).to.equal('jira issue create')
    })
  })

  describe('explainCommandDecision', () => {
    it('reports the disallow rule that blocks a command', () => {
      const config = {allowRules: [{pattern: '*'}], denyRules: [{pattern: 'jira *'}]}

      const decision = explainCommandDecision('jira issue create', config)

      expect(decision).to.deep.equal({allowed: false, pattern: 'jira *', reason: 'disallow-rule'})
    })

    it('reports the allow rule that permits a command', () => {
      const config = {allowRules: [{pattern: 'jira'}], denyRules: []}

      const decision = explainCommandDecision('jira issue create', config)

      expect(decision).to.deep.equal({allowed: true, pattern: 'jira', reason: 'allow-rule'})
    })

    it('reports default deny when no allow rule matches', () => {
      const config = {allowRules: [{pattern: 'mysql'}], denyRules: []}

      const decision = explainCommandDecision('jira', config)

      expect(decision).to.deep.equal({allowed: false, reason: 'no-allow-rule'})
    })

    it('prefers disallow over allow when both match', () => {
      const config = {allowRules: [{pattern: 'jira'}], denyRules: [{pattern: 'jira'}]}

      const decision = explainCommandDecision('jira', config)

      expect(decision).to.deep.equal({allowed: false, pattern: 'jira', reason: 'disallow-rule'})
    })
  })

  describe('permission topic exemption', () => {
    it('recognises the permission topic and its sub-commands', () => {
      expect(isPermissionCommand('permission')).to.equal(true)
      expect(isPermissionCommand('permission allow')).to.equal(true)
      expect(isPermissionCommand('permission remove')).to.equal(true)
      expect(isPermissionCommand('permissions')).to.equal(false)
      expect(isPermissionCommand('jira permission')).to.equal(false)
    })

    it('allows permission commands even when everything is disallowed', () => {
      const config = {allowRules: [], denyRules: [{pattern: '*'}]}

      expect(isCommandAllowed('permission allow', config)).to.equal(true)
      expect(isCommandAllowed('permission reset', config)).to.equal(true)
      expect(isCommandAllowed('jira', config)).to.equal(false)
    })

    it('allows permission commands when a disallow rule targets them directly', () => {
      const config = {allowRules: [{pattern: '*'}], denyRules: [{pattern: 'permission *'}]}

      expect(isCommandAllowed('permission remove', config)).to.equal(true)
    })

    it('explains permission commands as never gated', () => {
      const decision = explainCommandDecision('permission allow', {allowRules: [], denyRules: [{pattern: '*'}]})

      expect(decision).to.deep.equal({allowed: true, reason: 'permission-command'})
    })
  })
})
