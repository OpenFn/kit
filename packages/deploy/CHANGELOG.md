# @openfn/deploy

## 0.8.0

### Minor Changes

- 7c96d79: Support Kafka trigger type in CLI

## 0.7.1

### Patch Changes

- c3df1e5: Partially update vulnerable versions of braces - live-server is a holdout as there is not a newer version available.
- Updated dependencies [c3df1e5]
  - @openfn/logger@1.0.2

## 0.7.0

### Minor Changes

- 0d53f9b: Add support for basic project-credential management (add, associate with jobs) via the CLI

## 0.6.0

### Minor Changes

- b7fc4d0: Deploy: allow job body to be loaded from a file path in workflow.yaml

## 0.5.0

### Minor Changes

- 960f293: Add snapshots option to cli pull command

## 0.4.7

### Patch Changes

- 86119ea: Better error when a workfow is in state but not spec

## 0.4.6

### Patch Changes

- Allow steps in different workflows to have the same name

## 0.4.5

### Patch Changes

- adfb661: Error message for when workflow found in 'state' but not 'spec' during deploy

## 0.4.4

### Patch Changes

- 6d52ddf: Fix an issue pulling a project with no workflows

## 0.4.3

### Patch Changes

- Updated dependencies [2fde0ad]
  - @openfn/logger@1.0.1

## 0.4.2

### Patch Changes

- 86dd668: Log the result to success (not always)
- Updated dependencies [649ca43]
- Updated dependencies [9f6c35d]
- Updated dependencies [86dd668]
  - @openfn/logger@1.0.0

## 0.4.1

### Patch Changes

- Updated dependencies [649ca43]
  - @openfn/logger@0.0.20

## 0.4.0

### Minor Changes

- 2f7148c: Support `condition_expression` on edges

## 0.3.0

### Minor Changes

- 3f0010e: add support for javascript edge conditions

## 0.2.10

### Patch Changes

- 3c2de85: Remove the `enabled` flag from Jobs, and add to Triggers and Edges

## 0.2.9

### Patch Changes

- Updated dependencies [ca701e8]
  - @openfn/logger@0.0.19

## 0.2.8

### Patch Changes

- Updated dependencies [1b6fa8e]
  - @openfn/logger@0.0.18

## 0.2.7

### Patch Changes

- 7f4340d: Fixed resulting projectState.json from pull; fixed URLs in deploy
- 10021f6: Handle 404s when trying to deploy; better logging/error messages

## 0.2.6

### Patch Changes

- Updated dependencies
  - @openfn/logger@0.0.17

## 0.2.5

### Patch Changes

- Fix expected Lightning provisining path for versions greater than Lightning v0.7.3

## 0.2.4

### Patch Changes

- Update typings and some small refactoring

## 0.2.3

### Patch Changes

- 2a0aaa9: Bump inquirer
- Updated dependencies [2a0aaa9]
  - @openfn/logger@0.0.16

## 0.2.2

### Patch Changes

- faf1852: Downgrade tsup
- Updated dependencies [faf1852]
  - @openfn/logger@0.0.15

## 0.2.1

### Patch Changes

- 4c875b3: minor version bumps
- Updated dependencies [749afe8]
- Updated dependencies [4c875b3]
  - @openfn/logger@0.0.14

## 0.2.0

### Minor Changes

- df9d54c: users can now specify project description and cron trigger expression via CLI deploy
- fdf8cc2: Add --describe option to deploy

## 0.1.0

### Minor Changes

- c218a11: First Release
