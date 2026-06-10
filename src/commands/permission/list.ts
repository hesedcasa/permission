import {Command} from '@oclif/core'

import {readPermissionConfig} from '../../permission-config.js'

export default class PermissionList extends Command {
  static description = 'List all rules in the permission list'
  static examples = ['<%= config.bin %> permission list']

  async run(): Promise<void> {
    await this.parse(PermissionList)
    const config = await readPermissionConfig(this.config.configDir)

    const total = config.rules.length + config.allowRules.length
    if (total === 0) {
      this.log('No permission rules configured.')
      return
    }

    this.log(`${total} rule${total === 1 ? '' : 's'}:\n`)

    for (const rule of config.allowRules) {
      this.log(`  ✓ allow     ${rule.pattern}`)
    }

    for (const rule of config.rules) {
      this.log(`  ✗ disallow  ${rule.pattern}`)
    }
  }
}
