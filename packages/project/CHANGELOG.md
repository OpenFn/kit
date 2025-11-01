# @openfn/project

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
