import {Args, Command, Flags} from '@oclif/core'

import {canonicalPattern, readPermissionConfig, writePermissionConfig} from '../../permission-config.js'

export default class PermissionRemove extends Command {
  static args = {
    pattern: Args.string({
      description: 'Pattern to remove from the permission list.',
      required: true,
    }),
  }
  static description = 'Remove a rule from the permission list'
  static examples = [
    '<%= config.bin %> permission remove jira',
    '<%= config.bin %> permission remove "jira *"',
    '<%= config.bin %> permission remove jira --allow',
    '<%= config.bin %> permission remove jira --disallow',
  ]
  static flags = {
    allow: Flags.boolean({
      description: 'Only remove the pattern from the allow list',
    }),
    disallow: Flags.boolean({
      description: 'Only remove the pattern from the disallow list',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(PermissionRemove)
    const {pattern} = args

    const config = (await readPermissionConfig(this.config.configDir)) ?? {allowRules: [], denyRules: []}

    // With no scope flag the pattern is removed from both lists.
    const fromAllow = flags.allow || !flags.disallow
    const fromDisallow = flags.disallow || !flags.allow

    // "jira" and "jira *" match the same commands — remove either form.
    const matches = (r: {pattern: string}) => canonicalPattern(r.pattern) === canonicalPattern(pattern)
    const removed: string[] = []

    if (fromAllow) {
      for (const rule of config.allowRules.filter((r) => matches(r))) {
        removed.push(`Removed allow rule "${rule.pattern}".`)
      }

      config.allowRules = config.allowRules.filter((r) => !matches(r))
    }

    if (fromDisallow) {
      for (const rule of config.denyRules.filter((r) => matches(r))) {
        removed.push(`Removed disallow rule "${rule.pattern}".`)
      }

      config.denyRules = config.denyRules.filter((r) => !matches(r))
    }

    if (removed.length === 0) {
      this.log(`Pattern "${pattern}" was not found in the permission list.`)
      return
    }

    await writePermissionConfig(this.config.configDir, config)
    for (const line of removed) {
      this.log(line)
    }
  }
}
