# @openfn/runtime

## 0.0.33

### Patch Changes

- Updated dependencies [ca701e8]
  - @openfn/logger@0.0.19

## 0.0.32

### Patch Changes

- Add support to lazy load intial state and config
- d2360d4: Support a cacheKey to bust cached modules in long-running processes
- Add notify api
- 195f098: Trigger callbacks on job start, complete and init
- add deleteConfiguration option
- Fix intial state handling
- Updated dependencies [7e4529e]
  - @openfn/logger@0.0.18

## 0.0.31

### Patch Changes

- 0ff4f98: Ensure data can be an array
  Fix an issue where string next links in a workflow could use the wrong prior state

## 0.0.30

### Patch Changes

- 81d83a9: better handling of non-Error errors
- Updated dependencies
  - @openfn/logger@0.0.17

## 0.0.29

### Patch Changes

- 2a0aaa9: Bump semver
- Updated dependencies [2a0aaa9]
  - @openfn/logger@0.0.16

## 0.0.28

### Patch Changes

- faf1852: Downgrade tsup
- Updated dependencies [faf1852]
  - @openfn/logger@0.0.15

## 0.0.27

### Patch Changes

- 614c86b: Fixed an issue in error reporting
- 4c875b3: minor version bumps
- Updated dependencies [749afe8]
- Updated dependencies [4c875b3]
  - @openfn/logger@0.0.14

## 0.0.26

### Patch Changes

- Workflow jobs take state, rather than data (eg job.data -> job.state)
  Fix falsy edges (next: { job2: false })

## 0.0.25

### Patch Changes

- 2024ce8: Ensure jobs only receive direct upstream state

## 0.0.24

### Patch Changes

- 8d5c405: Support strict mode
- 0c5ee29: Throw when a workflow is invalid
- 26024a7: Better error handling and reporting
- 8d5c405: Better state handling in workflows
- 79f6d7c: Log job start and end (with duration)
  Demote operation timings down to info and debug
- Updated dependencies [6f51ce2]
  - @openfn/logger@0.0.13

## 0.0.23

### Patch Changes

- 91a3311: checked-in package-lock changes for language-common

## 0.0.22

### Patch Changes

- 1e6db3b: Ensure state returned from a job is serializable
- 320c468: Export type definitions
- c341ff0: Allow execution plans as input

## 0.0.21

### Patch Changes

- Updated dependencies [8dfc5bf]
  - @openfn/logger@0.0.12

## 0.0.20

### Patch Changes

- 60f695f: better path resolution
- Updated dependencies [d67f45a]
  - @openfn/logger@0.0.11

## 0.0.19

### Patch Changes

- Updated dependencies [38ad73e]
  - @openfn/logger@0.0.10

## 0.0.18

### Patch Changes

- e43d3ba: serialize job errors
- Updated dependencies [e43d3ba]
  - @openfn/logger@0.0.9

## 0.0.17

### Patch Changes

- 19e9f31: Improve logging in linker

## 0.0.16

### Patch Changes

- Fix imports for windows

## 0.0.15

### Patch Changes

- 986bf07: Allow modules to be imported from directories (lightning)
- 5c6fde4: Increase default timeout

## 0.0.14

### Patch Changes

- 47ac1a9: Add timeout
- 1695874: Fix module loading in node 19

## 0.0.13

### Patch Changes

- Updated dependencies [e95c133]
  - @openfn/logger@0.0.8

## 0.0.12

### Patch Changes

- Updated dependencies
  - @openfn/logger@0.0.7

## 0.0.11

### Patch Changes

- ba9bf80: Bug fixes
- Updated dependencies [2d07777]
  - @openfn/logger@0.0.6

## 0.0.10

### Patch Changes

- ef9406b: Support auto-install of modules
- 73d8199: Fix default repo location typo
- Updated dependencies
  - @openfn/logger@0.0.5

## 0.0.9

### Patch Changes

- 6d1d199: Support mutability in the runtime
- 28168a8: Updated build process
- Updated dependencies [28168a8]
  - @openfn/logger@0.0.4

## 0.0.8

### Patch Changes

- 92e5427: bump everything, npm package.json issues
- Updated dependencies [92e5427]
  - @openfn/logger@0.0.3

## 0.0.7

### Patch Changes

- fix broken package.json

## 0.0.6

### Patch Changes

- fix broken package.json

## 0.0.5

### Patch Changes

- f79bf9a: Added logger service to CLI, compiler and runtime
- Updated dependencies [f79bf9a]
  - @openfn/logger@0.0.2

## 0.0.4

### Patch Changes

- 5623913: Allow execute() function to be overriden by adaptors and jobs

## 0.0.3

### Patch Changes

- 8148cd5: Updated builds

## 0.0.2

### Patch Changes

- b5ce654: Remove runtime dependency on @openfn/language-common
- 3f6dc98: Initial release of new runtime, compiler and cli
