import {Command} from '@oclif/core'

import {PermissionConfig, readPermissionConfig} from '../../permission-config.js'

export default class PermissionList extends Command {
  static description = 'List all rules in the permission list'
  static enableJsonFlag = true
  static examples = ['<%= config.bin %> permission list', '<%= config.bin %> permission list --json']

  async run(): Promise<{config: null | PermissionConfig}> {
    await this.parse(PermissionList)
    const config = await readPermissionConfig(this.config.configDir)

    if (!config) {
      this.log('No rules configured — all commands allowed (default).')
      return {config}
    }

    const total = config.denyRules.length + config.allowRules.length
    if (total === 0) {
      this.log('No rules configured — all commands blocked (default deny; permission commands stay available).')
      return {config}
    }

    this.log(`${total} rule${total === 1 ? '' : 's'}:\n`)

    for (const rule of config.allowRules) {
      this.log(`  ✓ allow     ${rule.pattern}`)
    }

    for (const rule of config.denyRules) {
      this.log(`  ✗ disallow  ${rule.pattern}`)
    }

    return {config}
  }
}
