import {Errors, type Hook} from '@oclif/core'

import {isCommandAllowed, readPermissionConfig} from '../../permission-config.js'

/**
 * Blocks execution of commands not permitted by the current permission config.
 * This is a safety net: the init hook already hides disallowed commands from
 * listings, but this hook prevents a knowledgeable user from running them anyway.
 *
 * Default deny: a command must match an allow rule to execute. A missing
 * config file defaults to allowing all commands (allowRules: ["*"]).
 */
const hook: Hook<'prerun'> = async function ({Command, config}) {
  const permissionConfig = (await readPermissionConfig(config.configDir)) ?? {
    allowRules: [{pattern: '*'}],
    denyRules: [],
  }

  const normalizedId = Command.id.split(':').join(config.topicSeparator)
  if (!isCommandAllowed(normalizedId, permissionConfig)) {
    throw new Errors.CLIError(`Command "${normalizedId}" is not permitted.`)
  }
}

export default hook
