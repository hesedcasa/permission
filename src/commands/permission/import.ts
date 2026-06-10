import {Args, Command} from '@oclif/core'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'

import {PermissionConfig, writePermissionConfig} from '../../permission-config.js'

export default class PermissionImport extends Command {
  static args = {
    file: Args.string({
      description: 'File path to import the permission configuration from',
      required: true,
    }),
  }
  static description = 'Import the permission configuration from a JSON file'
  static examples = ['<%= config.bin %> permission import permission.json']

  async run(): Promise<void> {
    const {args} = await this.parse(PermissionImport)
    const filePath = resolve(args.file)

    let raw: string
    try {
      raw = await readFile(filePath, 'utf8')
    } catch {
      this.error(`Could not read file "${filePath}". Make sure the file exists and is readable.`)
    }

    let parsed: Partial<PermissionConfig>
    try {
      parsed = JSON.parse(raw) as Partial<PermissionConfig>
    } catch {
      this.error(`File "${filePath}" does not contain valid JSON.`)
    }

    if (!Array.isArray(parsed.rules)) {
      this.error(`File "${filePath}" is not a valid permission configuration (missing "rules" array).`)
    }

    for (const [i, rule] of parsed.rules.entries()) {
      if (typeof rule.pattern !== 'string') {
        this.error(`Disallow rule at index ${i} is invalid. Each rule must have a string "pattern".`)
      }
    }

    if (parsed.allowRules !== undefined && !Array.isArray(parsed.allowRules)) {
      this.error(`File "${filePath}" is not a valid permission configuration ("allowRules" must be an array).`)
    }

    const allowRules = parsed.allowRules ?? []
    for (const [i, rule] of allowRules.entries()) {
      if (typeof rule.pattern !== 'string') {
        this.error(`Allow rule at index ${i} is invalid. Each rule must have a string "pattern".`)
      }
    }

    const config: PermissionConfig = {allowRules, rules: parsed.rules}
    await writePermissionConfig(this.config.configDir, config)

    const total = config.rules.length + config.allowRules.length
    this.log(`Imported ${total} rule${total === 1 ? '' : 's'} from "${filePath}".`)
  }
}
