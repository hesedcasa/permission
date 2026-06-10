import {existsSync} from 'node:fs'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

interface PermissionRule {
  pattern: string
}

export interface PermissionConfig {
  allowRules: PermissionRule[]
  denyRules: PermissionRule[]
}

/**
 * Version of the on-disk config schema. Bump when the file format changes, so
 * migrations can branch on it instead of being inferred from missing keys.
 *
 * History:
 *   (no version) — pre-versioning. "rules" was the deny list; a file without
 *                  "allowRules" predates the allow list and means allow-all.
 *   1            — {version, allowRules, denyRules}
 */
export const CONFIG_VERSION = 1

/** On-disk shape across all supported schema versions. */
interface StoredPermissionConfig {
  allowRules?: null | PermissionRule[]
  denyRules?: PermissionRule[]
  /** Pre-versioning name for denyRules. */
  rules?: PermissionRule[]
  version?: number
}

export function permissionConfigPath(configDir: string): string {
  return join(configDir, 'permission.json')
}

/**
 * Reads the permission config from disk. Returns null when the config file does
 * not exist (plugin not yet configured). Callers decide how to handle the
 * absent-config case:
 *   - Hooks default to allowing all commands (allowRules: ["*"]) so the CLI
 *     remains usable before any rules are configured.
 *   - Commands treat it as an empty config ({allowRules: [], denyRules: []})
 *     so they can create the initial rules file from scratch.
 *
 * Unversioned (legacy) files are migrated on read: "rules" becomes denyRules,
 * and a missing "allowRules" means the file predates the allow list, so it
 * defaults to allow-all.
 *
 * Any other failure (malformed JSON, unreadable file, unsupported version)
 * throws, so a corrupted config never silently falls back to the allow-all
 * default.
 */
export async function readPermissionConfig(configDir: string | undefined): Promise<null | PermissionConfig> {
  if (!configDir) return null
  const filePath = permissionConfigPath(configDir)
  let content: string
  try {
    content = await readFile(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }

  let parsed: StoredPermissionConfig
  try {
    parsed = JSON.parse(content) as StoredPermissionConfig
  } catch (error) {
    throw new Error(`Permission config at ${filePath} is not valid JSON: ${(error as Error).message}`)
  }

  if (parsed.version !== undefined && parsed.version > CONFIG_VERSION) {
    throw new Error(
      `Permission config at ${filePath} has version ${parsed.version}, but this plugin only supports up to version ${CONFIG_VERSION}. Update the plugin.`,
    )
  }

  if (parsed.version === undefined) {
    // Legacy file: "rules" was the deny list; missing allowRules = allow-all.
    const allowRules = parsed.allowRules === undefined ? [{pattern: '*'}] : (parsed.allowRules ?? [])
    return {allowRules, denyRules: parsed.denyRules ?? parsed.rules ?? []}
  }

  return {allowRules: parsed.allowRules ?? [], denyRules: parsed.denyRules ?? []}
}

export async function writePermissionConfig(configDir: string, config: PermissionConfig): Promise<void> {
  if (!existsSync(configDir)) {
    await mkdir(configDir, {recursive: true})
  }

  const stored: StoredPermissionConfig = {
    allowRules: config.allowRules,
    denyRules: config.denyRules,
    version: CONFIG_VERSION,
  }
  await writeFile(permissionConfigPath(configDir), JSON.stringify(stored, null, 2), 'utf8')
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
 * Canonical form of a pattern for duplicate detection. "jira *" and "jira"
 * match the same set of commands (see matchesPattern), so both canonicalise
 * to "jira".
 */
export function canonicalPattern(pattern: string): string {
  const p = pattern.trim()
  if (p === '*') return p
  return p.endsWith(' *') ? p.slice(0, -2) : p
}

const PERMISSION_TOPIC = 'permission'

/**
 * The permission topic manages the config itself and is exempt from gating —
 * otherwise a rule like `disallow "*"` would lock the user out of ever
 * undoing it.
 */
export function isPermissionCommand(commandId: string): boolean {
  return commandId === PERMISSION_TOPIC || commandId.startsWith(PERMISSION_TOPIC + ' ')
}

type PermissionDecision =
  | {allowed: false; pattern: string; reason: 'disallow-rule'}
  | {allowed: false; reason: 'no-allow-rule'}
  | {allowed: true; pattern: string; reason: 'allow-rule'}
  | {allowed: true; reason: 'permission-command'}

/**
 * Explains whether a command id is allowed by the given permission config and
 * which rule decided it.
 *
 * Evaluation order:
 *   1. Permission commands are always allowed (never gated).
 *   2. If any disallow rule matches → blocked (disallow always wins).
 *   3. Command must match at least one allow rule (empty allow list = block all).
 *
 * Default deny: a command is allowed only when explicitly permitted by an
 * allow rule. Use allowRules: [{pattern: "*"}] to permit everything.
 */
export function explainCommandDecision(commandId: string, config: PermissionConfig): PermissionDecision {
  if (isPermissionCommand(commandId)) return {allowed: true, reason: 'permission-command'}

  const disallow = config.denyRules.find((rule) => matchesPattern(commandId, rule.pattern))
  if (disallow) return {allowed: false, pattern: disallow.pattern, reason: 'disallow-rule'}

  const allow = config.allowRules.find((rule) => matchesPattern(commandId, rule.pattern))
  if (allow) return {allowed: true, pattern: allow.pattern, reason: 'allow-rule'}

  return {allowed: false, reason: 'no-allow-rule'}
}

export function isCommandAllowed(commandId: string, config: PermissionConfig): boolean {
  return explainCommandDecision(commandId, config).allowed
}
