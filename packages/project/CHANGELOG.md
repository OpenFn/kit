# @openfn/project

## 0.10.0

### Minor Changes

- 4cc799b: Add support for aliases (replaces env)

### Patch Changes

- 3e63c08: Map project_credential_id to configuration
- 4cc799b: Project: remove `getIdentifier()` in favour of `qname` (qualified name)

## 0.9.3

### Patch Changes

- Updated dependencies [c70369b]
  - @openfn/logger@1.1.1

## 0.9.2

### Patch Changes

- 6766d96: Fixed an issue where credentials can get dropped in `deploy --beta`

## 0.9.1

### Patch Changes

- 72f18b1: Add a new project.yaml structure, which is the default "v2 state" used by each project. For now, this mirrors the internal structure of the runtime, rather than Lightning's structure
- Updated dependencies [72f18b1]
- Updated dependencies [2cc28a6]
  - @openfn/lexicon@1.2.7
  - @openfn/logger@1.1.0

## 0.9.0

### Minor Changes

- e93ec75: When generating props, write unexpected stuff to the .openfn object

### Patch Changes

- 5630eca: Fix an issue serialising keychain_credential_id to statefiles

## 0.8.1

### Patch Changes

- 2ebd35e: In the project generator, allow node properties to include underscores and dashes
- 27fdc42: Ensure that serialized state files have sorted arrays (enables better diffs)

## 0.8.0

### Minor Changes

- e427771: New additions to project generator:

  - Support edge properties `x-(enabled=false)-y`
  - Parse property values as boolean and unsigned int
  - Support chained attributes on workflows, like `@options.concurrency=2`

## 0.7.2

### Patch Changes

- 88f7f80: Read project files from JSON
- 435d55c: Allow project generator to generate uuids for project and workflow
- 64b6d4a: Ensure config.dirs is properly respected
- Updated dependencies
  - @openfn/lexicon@1.2.6

## 0.7.1

### Patch Changes

- 8632629: Internal refactor for clarity

## 0.7.0

### Minor Changes

- 16da2ef: Warn when merging two projects might result in lost work

### Patch Changes

- 16da2ef: Internal refactoring for clarity and cleaner APIs

## 0.6.1

### Patch Changes

- f955548: On merge, warn when projects may have diverged
- edfc759: Refactor project.repo to project.config
- 329d29d: Include `source_trigger_id` in generated workflows (for lightning compatibility)

## 0.6.0

### Minor Changes

- Add version hashes for workflows

## 0.5.1

### Patch Changes

- 81b97c3: Allow projects to be loaded directly from a file
- 43be979: Fix an issue loading the ohm grammer
- 25c7a2b: Allow a UUID map to be passed to the project generator
- 04a89e2: Add support for dirs in config
- 7d16875: When merging, allow the source project to specified as a path to a project file
- Updated dependencies [1f8d65e]
  - @openfn/lexicon@1.2.4

## 0.5.0

### Minor Changes

- 49caf75: Add project and workflow generator utility

## 0.4.1

### Patch Changes

- add getProjectPath

## 0.4.0

### Minor Changes

- 14b0b58: Export project generator

## 0.3.1

### Patch Changes

- ca3d6ca: Fix an issue pulling projects with pull --beta

## 0.3.0

### Minor Changes

- 7ae519b: Add Workspace class for Repo management

## 0.2.0

### Minor Changes

- Add support for merging projects

## 0.1.1

### Patch Changes

- Update dependencies
- Updated dependencies
  - @openfn/lexicon@1.2.3
  - @openfn/logger@1.0.6

## 0.1.0

- Initial release of project, with basic capability to sync fs and app state
