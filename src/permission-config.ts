import {existsSync} from 'node:fs'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

interface PermissionRule {
  pattern: string
}

export interface PermissionConfig {
  allowRules: PermissionRule[]
  rules: PermissionRule[]
}

function configFilePath(configDir: string): string {
  return join(configDir, 'permission.json')
}

/**
 * Reads the permission config from disk. Returns null when the config file does
 * not exist (plugin not yet configured). Callers decide how to handle the
 * absent-config case:
 *   - Hooks default to allowing all commands (allowRules: ["*"]) so the CLI
 *     remains usable before any rules are configured. Configs written before
 *     allowRules existed also default to ["*"] for upgrade compatibility.
 *   - Commands treat it as an empty config ({allowRules: [], rules: []}) so
 *     they can create the initial rules file from scratch.
 *
 * Any other failure (malformed JSON, unreadable file) throws, so a corrupted
 * config never silently falls back to the allow-all default.
 */
export async function readPermissionConfig(configDir: string | undefined): Promise<null | PermissionConfig> {
  if (!configDir) return null
  const filePath = configFilePath(configDir)
  let content: string
  try {
    content = await readFile(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }

  let parsed: Partial<PermissionConfig>
  try {
    parsed = JSON.parse(content) as Partial<PermissionConfig>
  } catch (error) {
    throw new Error(`Permission config at ${filePath} is not valid JSON: ${(error as Error).message}`)
  }

  const allowRules = parsed.allowRules === undefined ? [{pattern: '*'}] : (parsed.allowRules ?? [])
  return {allowRules, rules: parsed.rules ?? []}
}

export async function writePermissionConfig(configDir: string, config: PermissionConfig): Promise<void> {
  if (!existsSync(configDir)) {
    await mkdir(configDir, {recursive: true})
  }

  await writeFile(configFilePath(configDir), JSON.stringify(config, null, 2), 'utf8')
}

/**
 * Returns true if a command ID matches the given pattern.
 *
 * Pattern forms:
 *   "*"            — matches every command
 *   "jira"         — matches the exact command "jira" AND any command in the
 *                    "jira" topic (e.g. "jira issue", "jira issue create")
 *   "jira *"       — same as above (explicit wildcard)
 *   "jira issue *" — matches "jira issue" and any sub-command thereof
 *   "jira issue"   — exact match only (no sub-commands unless "jira issue *" is used)
 *
 * Note: bare topic pattern "jira" also matches "jira" itself, mirroring the
 * behaviour of "jira *" for topic-level allow/disallow convenience.
 */
export function matchesPattern(commandId: string, pattern: string): boolean {
  const p = pattern.trim()

  if (p === '*') return true

  // Trailing " *" — strip the wildcard and treat as a prefix match
  if (p.endsWith(' *')) {
    const prefix = p.slice(0, -2)
    return commandId === prefix || commandId.startsWith(prefix + ' ')
  }

  // Exact match
  if (commandId === p) return true

  // Topic match: bare "jira" also covers "jira issue", "jira issue create", etc.
  if (commandId.startsWith(p + ' ')) return true

  return false
}

/**
 * Returns true if a command id is allowed by the given permission config.
 *
 * Evaluation order:
 *   1. If any disallow rule matches → blocked (disallow always wins).
 *   2. Command must match at least one allow rule (empty allow list = block all).
 *
 * Default deny: a command is allowed only when explicitly permitted by an
 * allow rule. Use allowRules: [{pattern: "*"}] to permit everything.
 */
export function isCommandAllowed(commandId: string, config: PermissionConfig): boolean {
  if (config.rules.some((rule) => matchesPattern(commandId, rule.pattern))) return false
  return config.allowRules.some((rule) => matchesPattern(commandId, rule.pattern))
}
