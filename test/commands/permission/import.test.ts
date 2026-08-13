import {expect} from 'chai'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'

import PermissionImport from '../../../src/commands/permission/import.js'
import {readPermissionConfig} from '../../../src/permission-config.js'

function makeImport(argv: string[], configDir: string): {cmd: PermissionImport; output: () => string} {
  const lines: string[] = []
  const config = {
    bin: 'sdkck',
    configDir,
    runHook: async () => ({failures: [], successes: []}),
  } as never
  const cmd = new PermissionImport(argv, config)
  cmd.log = (message = '') => {
    lines.push(String(message))
  }

  return {cmd, output: () => lines.join('\n')}
}

describe('permission import', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'sdkck-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true})
  })

  it('imports rules from a valid JSON file', async () => {
    const rules = [{pattern: 'jira'}, {pattern: 'mysql'}]
    const inFile = path.join(tmpDir, 'input.json')
    await writeFile(inFile, JSON.stringify({rules}), 'utf8')

    const {cmd, output} = makeImport([inFile], tmpDir)
    await cmd.run()

    expect(output()).to.contain('Imported 2 rules')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.denyRules).to.deep.equal(rules)
  })

  it('imports a single rule with correct singular message', async () => {
    const inFile = path.join(tmpDir, 'input.json')
    await writeFile(inFile, JSON.stringify({allowRules: [], rules: [{pattern: '*'}]}), 'utf8')

    const {cmd, output} = makeImport([inFile], tmpDir)
    await cmd.run()

    expect(output()).to.contain('Imported 1 rule')
    expect(output()).to.not.contain('Imported 1 rules')
  })

  it('throws for a non-existent file', async () => {
    const {cmd} = makeImport([path.join(tmpDir, 'missing.json')], tmpDir)
    let threw = false
    try {
      await cmd.run()
    } catch {
      threw = true
    }

    expect(threw).to.be.true
  })

  it('throws for a file with invalid JSON', async () => {
    const inFile = path.join(tmpDir, 'bad.json')
    await writeFile(inFile, 'not json', 'utf8')
    const {cmd} = makeImport([inFile], tmpDir)
    let threw = false
    try {
      await cmd.run()
    } catch {
      threw = true
    }

    expect(threw).to.be.true
  })

  it('throws when the rules field is missing', async () => {
    const inFile = path.join(tmpDir, 'noarray.json')
    await writeFile(inFile, JSON.stringify({somethingElse: []}), 'utf8')
    const {cmd} = makeImport([inFile], tmpDir)
    let threw = false
    try {
      await cmd.run()
    } catch {
      threw = true
    }

    expect(threw).to.be.true
  })

  it('throws when a rule has no pattern', async () => {
    const inFile = path.join(tmpDir, 'badpattern.json')
    await writeFile(inFile, JSON.stringify({rules: [{notAPattern: 'jira'}]}), 'utf8')
    const {cmd} = makeImport([inFile], tmpDir)
    let threw = false
    try {
      await cmd.run()
    } catch {
      threw = true
    }

    expect(threw).to.be.true
  })

  it('defaults legacy files without allowRules to allow all commands', async () => {
    const inFile = path.join(tmpDir, 'legacy.json')
    await writeFile(inFile, JSON.stringify({rules: [{pattern: 'mysql'}]}), 'utf8')

    const {cmd} = makeImport([inFile], tmpDir)
    await cmd.run()

    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.deep.equal([{pattern: '*'}])
  })

  it('throws when allowRules is null', async () => {
    const inFile = path.join(tmpDir, 'badallowrules.json')
    await writeFile(inFile, JSON.stringify({allowRules: null, rules: []}), 'utf8')
    const {cmd} = makeImport([inFile], tmpDir)
    let threw = false
    try {
      await cmd.run()
    } catch {
      threw = true
    }

    expect(threw).to.be.true
  })

  it('imports a versioned file with denyRules', async () => {
    const inFile = path.join(tmpDir, 'v1.json')
    await writeFile(
      inFile,
      JSON.stringify({allowRules: [{pattern: '*'}], denyRules: [{pattern: 'mysql'}], version: 1}),
      'utf8',
    )

    const {cmd, output} = makeImport([inFile], tmpDir)
    await cmd.run()

    expect(output()).to.contain('Imported 2 rules')
    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.deep.equal([{pattern: '*'}])
    expect(saved.denyRules).to.deep.equal([{pattern: 'mysql'}])
  })

  it('does not apply the legacy allow-all default to versioned files', async () => {
    const inFile = path.join(tmpDir, 'v1-noallow.json')
    await writeFile(inFile, JSON.stringify({denyRules: [], version: 1}), 'utf8')

    const {cmd} = makeImport([inFile], tmpDir)
    await cmd.run()

    const saved = (await readPermissionConfig(tmpDir))!
    expect(saved.allowRules).to.deep.equal([])
  })

  it('throws when the file version is newer than supported', async () => {
    const inFile = path.join(tmpDir, 'future.json')
    await writeFile(inFile, JSON.stringify({allowRules: [], denyRules: [], version: 99}), 'utf8')

    const {cmd} = makeImport([inFile], tmpDir)
    let error: Error | undefined
    try {
      await cmd.run()
    } catch (error_) {
      error = error_ as Error
    }

    expect(error?.message).to.contain('version 99')
  })
})
