import {Args, Command} from '@oclif/core'

import {canonicalPattern, matchesPattern, readPermissionConfig, writePermissionConfig} from '../../permission-config.js'

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

    const config = (await readPermissionConfig(this.config.configDir)) ?? {allowRules: [], denyRules: []}

    // "jira" and "jira *" match the same commands — treat them as duplicates.
    const duplicate = config.allowRules.find((r) => canonicalPattern(r.pattern) === canonicalPattern(pattern))
    if (duplicate) {
      this.log(
        duplicate.pattern === pattern
          ? `Pattern "${pattern}" is already in the allow list.`
          : `Pattern "${pattern}" is already covered by "${duplicate.pattern}" in the allow list.`,
      )
      return
    }

    config.allowRules.push({pattern})

    await writePermissionConfig(this.config.configDir, config)
    this.log(`Added allow rule for "${pattern}".`)

    const knownIds = (this.config.commands ?? []).map((c) => c.id.replaceAll(':', this.config.topicSeparator ?? ' '))
    if (knownIds.length > 0 && !knownIds.some((id) => matchesPattern(id, pattern))) {
      this.warn(`Pattern "${pattern}" does not match any known command — check it for typos.`)
    }
  }
}
