# permission

Permission management plugin

[![Version](https://img.shields.io/npm/v/@hesed/permission.svg)](https://npmjs.org/package/@hesed/permission)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/hesedcasa/@hesed/permission/blob/main/LICENSE)
[![Downloads/week](https://img.shields.io/npm/dw/@hesed/permission.svg)](https://npmjs.org/package/@hesed/permission)

<!-- toc -->
* [permission](#permission)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g @hesed/permission
$ permission COMMAND
running command...
$ permission (--version)
@hesed/permission/0.3.1 linux-x64 node-v22.23.1
$ permission --help [COMMAND]
USAGE
  $ permission COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`permission permission allow PATTERN`](#permission-permission-allow-pattern)
* [`permission permission check COMMAND`](#permission-permission-check-command)
* [`permission permission disallow PATTERN`](#permission-permission-disallow-pattern)
* [`permission permission export FILE`](#permission-permission-export-file)
* [`permission permission import FILE`](#permission-permission-import-file)
* [`permission permission list`](#permission-permission-list)
* [`permission permission remove PATTERN`](#permission-permission-remove-pattern)
* [`permission permission reset`](#permission-permission-reset)

## `permission permission allow PATTERN`

Allow a command pattern in the permission list

```
USAGE
  $ permission permission allow PATTERN

ARGUMENTS
  PATTERN  Command pattern to allow.

DESCRIPTION
  Allow a command pattern in the permission list

EXAMPLES
  $ permission permission allow "*"

  $ permission permission allow jira

  $ permission permission allow "jira *"

  $ permission permission allow "jira issue create"
```

_See code: [src/commands/permission/allow.ts](https://github.com/hesedcasa/permission/blob/v0.3.1/src/commands/permission/allow.ts)_

## `permission permission check COMMAND`

Check whether a command is allowed and which rule decides it

```
USAGE
  $ permission permission check COMMAND...

ARGUMENTS
  COMMAND...  Command to check, e.g. "jira issue create"

DESCRIPTION
  Check whether a command is allowed and which rule decides it

EXAMPLES
  $ permission permission check jira

  $ permission permission check "jira issue create"

  $ permission permission check jira issue create
```

_See code: [src/commands/permission/check.ts](https://github.com/hesedcasa/permission/blob/v0.3.1/src/commands/permission/check.ts)_

## `permission permission disallow PATTERN`

Disallow a command pattern in the permission list

```
USAGE
  $ permission permission disallow PATTERN

ARGUMENTS
  PATTERN  Command pattern to disallow.

DESCRIPTION
  Disallow a command pattern in the permission list

EXAMPLES
  $ permission permission disallow "*"

  $ permission permission disallow jira

  $ permission permission disallow "jira *"

  $ permission permission disallow "jira issue create"
```

_See code: [src/commands/permission/disallow.ts](https://github.com/hesedcasa/permission/blob/v0.3.1/src/commands/permission/disallow.ts)_

## `permission permission export FILE`

Export the permission configuration to a JSON file

```
USAGE
  $ permission permission export FILE

ARGUMENTS
  FILE  File path to export the permission configuration to

DESCRIPTION
  Export the permission configuration to a JSON file

EXAMPLES
  $ permission permission export permission.json
```

_See code: [src/commands/permission/export.ts](https://github.com/hesedcasa/permission/blob/v0.3.1/src/commands/permission/export.ts)_

## `permission permission import FILE`

Import the permission configuration from a JSON file

```
USAGE
  $ permission permission import FILE

ARGUMENTS
  FILE  File path to import the permission configuration from

DESCRIPTION
  Import the permission configuration from a JSON file

EXAMPLES
  $ permission permission import permission.json
```

_See code: [src/commands/permission/import.ts](https://github.com/hesedcasa/permission/blob/v0.3.1/src/commands/permission/import.ts)_

## `permission permission list`

List all rules in the permission list

```
USAGE
  $ permission permission list [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List all rules in the permission list

EXAMPLES
  $ permission permission list

  $ permission permission list --json
```

_See code: [src/commands/permission/list.ts](https://github.com/hesedcasa/permission/blob/v0.3.1/src/commands/permission/list.ts)_

## `permission permission remove PATTERN`

Remove a rule from the permission list

```
USAGE
  $ permission permission remove PATTERN [--allow] [--disallow]

ARGUMENTS
  PATTERN  Pattern to remove from the permission list.

FLAGS
  --allow     Only remove the pattern from the allow list
  --disallow  Only remove the pattern from the disallow list

DESCRIPTION
  Remove a rule from the permission list

EXAMPLES
  $ permission permission remove jira

  $ permission permission remove "jira *"

  $ permission permission remove jira --allow

  $ permission permission remove jira --disallow
```

_See code: [src/commands/permission/remove.ts](https://github.com/hesedcasa/permission/blob/v0.3.1/src/commands/permission/remove.ts)_

## `permission permission reset`

Reset all permission rules

```
USAGE
  $ permission permission reset [--confirm]

FLAGS
  --confirm  Skip the confirmation prompt

DESCRIPTION
  Reset all permission rules

EXAMPLES
  $ permission permission reset

  $ permission permission reset --confirm
```

_See code: [src/commands/permission/reset.ts](https://github.com/hesedcasa/permission/blob/v0.3.1/src/commands/permission/reset.ts)_
<!-- commandsstop -->
