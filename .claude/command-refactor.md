# Refactoring Commands into the Project Subcommand

This guide outlines the steps to refactor an existing CLI command into a subcommand under the `project` command structure.

## Example Reference

Use `src/projects/list.ts` as the reference pattern for all refactored commands.

## Steps

### 1. Create the New Command File

Create a new file in `src/projects/<command-name>.ts` that consolidates all the existing command files.

**Key elements:**
- Import `yargs`, `ensure`, `build`, `Logger`, and options from `../options`
- Define a `<CommandName>Options` type that picks required fields from `Opts`
- Create an `options` array with the required options (e.g., `[o.workflow, o.workspace, o.workflowMappings]`)
- Export a default `command` object with:
  - `command: '<command-name> [args]'` (just the subcommand name, not the full path)
  - `describe: 'description of the command'`
  - `handler: ensure('project-<command-name>', options)` (note the `project-` prefix)
  - `builder: (yargs) => build(options, yargs)`
- Export a named `handler` function that takes `(options: <CommandName>Options, logger: Logger)`

**Example structure:**
```typescript
import yargs from 'yargs';
import { Workspace } from '@openfn/project';

import { ensure, build } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';
import type { Opts } from '../options';

export type VersionOptions = Required<
  Pick<Opts, 'command' | 'workflow' | 'workspace' | 'workflowMappings' | 'json'>
>;

const options = [o.workflow, o.workspace, o.workflowMappings];

const command: yargs.CommandModule = {
  command: 'version [workflow]',
  describe: 'Returns the version hash of a given workflow in a workspace',
  handler: ensure('project-version', options),
  builder: (yargs) => build(options, yargs),
};

export default command;

export const handler = async (options: VersionOptions, logger: Logger) => {
  // Implementation here
};
```

### 2. Update `src/projects/handler.ts`

Add a named export for your new handler:

```typescript
export { handler as list } from './list';
export { handler as version } from './version';
export { handler as <commandName> } from './<commandName>';
```

### 3. Update `src/projects/command.ts`

Import and register your new command:

```typescript
import list from './list';
import version from './version';
import <commandName> from './<commandName>';

export const projectsCommand = {
  // ...
  builder: (yargs: yargs.Argv) =>
    yargs
      .command(list)
      .command(version)
      .command(<commandName>)
      // ...
};
```

### 4. Update `src/commands.ts`

Make three changes:

**a) Remove the old import** (if it exists):
```typescript
// Remove: import commandName from './<command>/handler';
```

**b) Add to CommandList type:**
```typescript
export type CommandList =
  | 'apollo'
  // ...
  | 'project-list'
  | 'project-version'
  | 'project-<command-name>'  // Add this line
  | 'test'
  | 'version';
```

**c) Add to handlers object:**
```typescript
const handlers = {
  // ...
  ['project-list']: projects.list,
  ['project-version']: projects.version,
  ['project-<command-name>']: projects.<commandName>,  // Add this line
  // ...
};
```

**d) Update any existing handler references:**
If the old command was referenced elsewhere in the handlers object (like `project: workflowVersion`), update or remove it as needed.

### 5. Delete the Old Command Folder

Remove the old command directory:
```bash
rm -rf packages/cli/src/<command-name>
```

## Optional: Aliasing Commands at Top Level

If you want to keep the command available at the top level (e.g., `openfn merge` in addition to `openfn project merge`), follow these additional steps.

**Important:** When aliasing, the alias only exists in `src/cli.ts` where yargs commands are registered. Do NOT add separate handlers or command list entries in `src/commands.ts` - only keep the `project-<command-name>` entries there.

### 6. Update `src/cli.ts`

Import the command directly from the project subcommand file and register it:

```typescript
import projectsCommand from './projects/command';
import mergeCommand from './projects/merge';
import checkoutCommand from './checkout/command';
```

The command will be registered with yargs:
```typescript
.command(projectsCommand)
.command(mergeCommand)  // Top-level alias
.command(checkoutCommand)
```

### How It Works

- In `src/cli.ts`: Both `merge` and `project merge` are registered as yargs commands
- In `src/commands.ts`: Only `project-merge` exists in CommandList and handlers (no `merge` entry)
- The yargs command handler (`ensure('project-merge', options)`) routes both command invocations to the same handler

This is different from the `install`/`repo install` pattern, where both entries exist in the handlers object.

## Common Patterns

### Options to Use
- Always include `o.workspace` for project-related commands
- Use `o.workflow` for workflow-specific operations
- Include `o.json` if the command supports JSON output
- Include `o.log` for commands that need detailed logging

### Handler Pattern
- Use `new Workspace(options.workspace)` to access the workspace
- Check `workspace.valid` before proceeding
- Use `workspace.getActiveProject()` to get the current project
- Use appropriate logger methods: `logger.info()`, `logger.error()`, `logger.success()`

### Testing Pattern
If the old command has tests, they need to be refactored:

1. **Create new test file**: Move from `test/<command>/handler.test.ts` to `test/projects/<command>.test.ts`
2. **Update imports**:
   - Change `import handler from '../../src/<command>/handler'`
   - To `import { handler } from '../../src/projects/<command>'`
3. **Update command names in tests**: Change all `command: '<command>'` to `command: 'project-<command>'` in test option objects
4. **Delete old test folder**: Remove `test/<command>` directory

**Example changes:**
```typescript
// Before:
import mergeHandler from '../../src/merge/handler';
await mergeHandler({ command: 'merge', ... }, logger);

// After:
import { handler as mergeHandler } from '../../src/projects/merge';
await mergeHandler({ command: 'project-merge', ... }, logger);
```

## Checklist

### Basic Refactoring
- [ ] Create new file in `src/projects/<command-name>.ts`
- [ ] Define `<CommandName>Options` type
- [ ] Export default command object with `ensure('project-<command-name>', options)`
- [ ] Export named `handler` function
- [ ] Add export to `src/projects/handler.ts`
- [ ] Import and register in `src/projects/command.ts`
- [ ] Add `'project-<command-name>'` to `CommandList` in `src/commands.ts`
- [ ] Add handler to handlers object in `src/commands.ts`
- [ ] Remove old import from `src/commands.ts` if it exists
- [ ] Delete old command folder

### Testing (if applicable)
- [ ] Create new test file in `test/projects/<command-name>.test.ts`
- [ ] Update import to use `{ handler } from '../../src/projects/<command-name>'`
- [ ] Update all `command: '<command>'` to `command: 'project-<command>'` in test cases
- [ ] Delete old test folder `test/<command>`
- [ ] Run tests to verify they pass

### Additional Steps for Top-Level Aliasing
- [ ] Import command directly in `src/cli.ts` (e.g., `import mergeCommand from './projects/merge'`)
- [ ] Register the imported command with `.command(mergeCommand)`
- [ ] Verify NO duplicate entries in `src/commands.ts` - only `project-<command-name>` should exist, not `<command-name>`
- [ ] Test both `openfn <command>` and `openfn project <command>`
