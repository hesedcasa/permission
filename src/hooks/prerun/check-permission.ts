import {Errors, Hook} from '@oclif/core'

import {isCommandAllowed, readPermissionConfig} from '../../permission-config.js'

/**
 * Blocks execution of commands not permitted by the current permission config.
 * This is a safety net: the init hook already hides disallowed commands from
 * listings, but this hook prevents a knowledgeable user from running them anyway.
 *
 * Evaluation order: disallow rules first (always win), then allow list
 * (if non-empty, only matched commands are permitted), then default allow.
 */
const hook: Hook<'prerun'> = async function ({Command, config}) {
  const permissionConfig = await readPermissionConfig(config.configDir)
  if (permissionConfig.rules.length === 0 && permissionConfig.allowRules.length === 0) return

  const normalizedId = Command.id.replaceAll(':', config.topicSeparator)
  if (!isCommandAllowed(normalizedId, permissionConfig)) {
    throw new Errors.CLIError(`Command "${normalizedId}" is not permitted.`)
  }
}

export default hook
