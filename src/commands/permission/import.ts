import {Args, Command} from '@oclif/core'
import {readFile} from 'node:fs/promises'
import path from 'node:path'

import {CONFIG_VERSION, type PermissionConfig, writePermissionConfig} from '../../permission-config.js'

/** Accepted file shape across all supported schema versions. */
type ImportedConfig = {
  allowRules?: Array<{pattern: string}> | null
  denyRules?: Array<{pattern: string}>
  /** Pre-versioning name for denyRules. */
  rules?: Array<{pattern: string}>
  version?: number
}

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
    const filePath = path.resolve(args.file)

    let raw: string
    try {
      raw = await readFile(filePath, 'utf8')
    } catch {
      this.error(`Could not read file "${filePath}". Make sure the file exists and is readable.`)
    }

    let parsed: ImportedConfig
    try {
      parsed = JSON.parse(raw) as ImportedConfig
    } catch {
      this.error(`File "${filePath}" does not contain valid JSON.`)
    }

    if (parsed.version !== undefined && parsed.version > CONFIG_VERSION) {
      this.error(
        `File "${filePath}" has config version ${parsed.version}, but this plugin only supports up to version ${CONFIG_VERSION}. Update the plugin.`,
      )
    }

    // "rules" is the pre-versioning name for denyRules.
    const denyRules = parsed.denyRules ?? parsed.rules
    if (!Array.isArray(denyRules)) {
      this.error(`File "${filePath}" is not a valid permission configuration (missing "denyRules" array).`)
    }

    for (const [i, rule] of denyRules.entries()) {
      if (typeof rule.pattern !== 'string') {
        this.error(`Disallow rule at index ${i} is invalid. Each rule must have a string "pattern".`)
      }
    }

    if (parsed.allowRules !== undefined && !Array.isArray(parsed.allowRules)) {
      this.error(`File "${filePath}" is not a valid permission configuration ("allowRules" must be an array).`)
    }

    // Mirror readPermissionConfig's legacy handling: an unversioned file
    // without allowRules predates the allow list and means "allow everything".
    const allowRules = parsed.allowRules ?? (parsed.version === undefined ? [{pattern: '*'}] : [])
    for (const [i, rule] of allowRules.entries()) {
      if (typeof rule.pattern !== 'string') {
        this.error(`Allow rule at index ${i} is invalid. Each rule must have a string "pattern".`)
      }
    }

    const config: PermissionConfig = {allowRules, denyRules}
    await writePermissionConfig(this.config.configDir, config)

    // Count only rules that came from the file, not the synthesized legacy
    // allow-all rule.
    const total = denyRules.length + (parsed.allowRules?.length ?? 0)
    this.log(`Imported ${total} rule${total === 1 ? '' : 's'} from "${filePath}".`)
  }
}
