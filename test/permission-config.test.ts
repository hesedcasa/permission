import {expect} from 'chai'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {isCommandAllowed, readPermissionConfig, writePermissionConfig} from '../src/permission-config.js'

describe('permission config', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sdkck-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true})
  })

  it('defaults old configs without allowRules to allow all commands', async () => {
    await writeFile(join(tmpDir, 'permission.json'), JSON.stringify({rules: [{pattern: 'mysql'}]}), 'utf8')

    const config = (await readPermissionConfig(tmpDir))!

    expect(config.allowRules).to.deep.equal([{pattern: '*'}])
    expect(config.rules).to.deep.equal([{pattern: 'mysql'}])
    expect(isCommandAllowed('jira', config)).to.equal(true)
    expect(isCommandAllowed('mysql', config)).to.equal(false)
  })

  it('preserves an explicit empty allowRules list', async () => {
    await writePermissionConfig(tmpDir, {allowRules: [], rules: []})

    const config = (await readPermissionConfig(tmpDir))!

    expect(config.allowRules).to.deep.equal([])
    expect(isCommandAllowed('jira', config)).to.equal(false)
  })
})
