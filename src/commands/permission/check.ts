import {Args, Command} from '@oclif/core'

import {explainCommandDecision, readPermissionConfig} from '../../permission-config.js'

export default class PermissionCheck extends Command {
  static args = {
    command: Args.string({
      description: 'Command to check, e.g. "jira issue create"',
      required: true,
    }),
  }

  static description = 'Check whether a command is allowed and which rule decides it'
  static examples = [
    '<%= config.bin %> permission check jira',
    '<%= config.bin %> permission check "jira issue create"',
    '<%= config.bin %> permission check jira issue create',
  ]

  // Accept unquoted multi-word commands: `permission check jira issue create`.
  static strict = false

  async run(): Promise<void> {
    const {argv} = await this.parse(PermissionCheck)
    const commandId = (argv as string[]).join(' ').trim()

    const config = await readPermissionConfig(this.config.configDir)
    if (!config) {
      this.log(`✓ "${commandId}" is allowed — no permission config exists, so all commands are allowed by default.`)
      return
    }

    const decision = explainCommandDecision(commandId, config)
    if (decision.reason === 'permission-command') {
      this.log(`✓ "${commandId}" is always allowed — permission commands are never gated.`)
      return
    }

    if (decision.reason === 'allow-rule') {
      this.log(`✓ "${commandId}" is allowed by allow rule "${decision.pattern}".`)
      return
    }

    if (decision.reason === 'disallow-rule') {
      this.log(`✗ "${commandId}" is blocked by disallow rule "${decision.pattern}".`)
    } else {
      this.log(`✗ "${commandId}" is blocked — no allow rule matches it (default deny).`)
    }

    this.exit(1)
  }
}
