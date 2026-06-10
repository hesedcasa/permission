import {Args, Command} from '@oclif/core'

import {
  canonicalPattern,
  isPermissionCommand,
  matchesPattern,
  readPermissionConfig,
  writePermissionConfig,
} from '../../permission-config.js'

export default class PermissionDisallow extends Command {
  static args = {
    pattern: Args.string({
      description: 'Command pattern to disallow.',
      required: true,
    }),
  }
  static description = 'Disallow a command pattern in the permission list'
  static examples = [
    '<%= config.bin %> permission disallow "*"',
    '<%= config.bin %> permission disallow jira',
    '<%= config.bin %> permission disallow "jira *"',
    '<%= config.bin %> permission disallow "jira issue create"',
  ]

  async run(): Promise<void> {
    const {args} = await this.parse(PermissionDisallow)
    const {pattern} = args

    // No config file means everything is currently allowed — preserve that
    // when creating the file, so disallowing one command doesn't silently
    // switch the CLI to deny-everything.
    const config = (await readPermissionConfig(this.config.configDir)) ?? {
      allowRules: [{pattern: '*'}],
      denyRules: [],
    }

    // "jira" and "jira *" match the same commands — treat them as duplicates.
    const duplicate = config.denyRules.find((r) => canonicalPattern(r.pattern) === canonicalPattern(pattern))
    if (duplicate) {
      this.log(
        duplicate.pattern === pattern
          ? `Pattern "${pattern}" is already in the disallow list.`
          : `Pattern "${pattern}" is already covered by "${duplicate.pattern}" in the disallow list.`,
      )
      return
    }

    config.denyRules.push({pattern})

    await writePermissionConfig(this.config.configDir, config)
    this.log(`Added disallow rule for "${pattern}".`)

    // A pattern aimed at the permission topic is accepted but has no effect,
    // since permission commands are exempt from gating — say so up front.
    if (isPermissionCommand(canonicalPattern(pattern))) {
      this.log('Note: permission commands are never gated, so this rule will not block them.')
    }

    const knownIds = (this.config.commands ?? []).map((c) => c.id.replaceAll(':', this.config.topicSeparator ?? ' '))
    if (knownIds.length > 0 && !knownIds.some((id) => matchesPattern(id, pattern))) {
      this.warn(`Pattern "${pattern}" does not match any known command — check it for typos.`)
    }
  }
}
