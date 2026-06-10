import {Args, Command} from '@oclif/core'

import {readPermissionConfig, writePermissionConfig} from '../../permission-config.js'

export default class PermissionAllow extends Command {
  static args = {
    pattern: Args.string({
      description: 'Command pattern to allow.',
      required: true,
    }),
  }
  static description = 'Allow a command pattern in the permission list'
  static examples = [
    '<%= config.bin %> permission allow "*"',
    '<%= config.bin %> permission allow jira',
    '<%= config.bin %> permission allow "jira *"',
    '<%= config.bin %> permission allow "jira issue create"',
  ]

  async run(): Promise<void> {
    const {args} = await this.parse(PermissionAllow)
    const {pattern} = args

    const config = (await readPermissionConfig(this.config.configDir)) ?? {allowRules: [], rules: []}

    const exists = config.allowRules.some((r) => r.pattern === pattern)
    if (exists) {
      this.log(`Pattern "${pattern}" is already in the allow list.`)
      return
    }

    config.allowRules.push({pattern})

    await writePermissionConfig(this.config.configDir, config)
    this.log(`Added allow rule for "${pattern}".`)
  }
}
