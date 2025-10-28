# @openfn/runtime

## 1.7.4

### Patch Changes

- 3cd3cd5: Don't log edge condition code

## 1.7.3

### Patch Changes

- 84bebf4: Fix an issue where certain error messages are badly processed the runtime & worker. This resulted in cryptic errors like "src.js is not in the SourceMap".

## 1.7.2

### Patch Changes

- Update dependencies
- Updated dependencies
  - @openfn/logger@1.0.6

## 1.7.1

### Patch Changes

- f04acef: Fix an issue reading package.json on autoinstalled adaptors

## 1.7.0

### Minor Changes

- 9d4ece3: Add support for global functions in execution plan

## 1.6.4

### Patch Changes

- Updated dependencies [0a176aa]
  - @openfn/logger@1.0.5

## 1.6.3

### Patch Changes

- 2667710: Fix an issue where step completion time is logged with double units (ie, `2msms`)

## 1.6.2

### Patch Changes

- beb4617: Ensure that AdaptorError details are safely serialised

## 1.6.1

### Patch Changes

- 70e3d7a: Fix error reporting when loading adaptors from the monorepo

## 1.6.0

### Minor Changes

- 4ddd4d6: Update errors to include a source-mapped position and more dignostic information

### Patch Changes

- aaa7e7b: General improvements to how errors are reported. Includes a stack trace, removal of irrelevant or redundant information, and cleaner formatting
- Updated dependencies [6e87156]
  - @openfn/logger@1.0.4

## 1.5.4

### Patch Changes

- Ensure support for node 18,20 and 22.

  This update ensures compatibility with node 18 LTS, 20 LTS, and 22.12.

  Most of the changes are in the build and test suites and have only minor impact on production code. No issues are anticipated as as result of this change.

  Prior releases may fail on node version >=20.

  Support for node 18 will be removed in late 2025.

- 8904af2: Fix an issue in the linker where imported modules may not be properly awaited
- Updated dependencies
  - @openfn/logger@1.0.3

## 1.5.3

### Patch Changes

- 1cbbba0: warn when an expression doesn't return state

## 1.5.2

### Patch Changes

- f6bd593: Move cleaning of state from expression to step, resulting in clearer logs.

## 1.5.1

### Patch Changes

- eeb660d: Fix an issue from previous patch where initial state.configuration could be lost at the start of a step

## 1.5.0

### Minor Changes

- 3463ff9: Support global credential object on a workflow

## 1.4.2

### Patch Changes

- c3df1e5: Partially update vulnerable versions of braces - live-server is a holdout as there is not a newer version available.
- Updated dependencies [c3df1e5]
  - @openfn/logger@1.0.2

## 1.4.1

### Patch Changes

- 40fd45b: Allow the linker to directly import some whitelisted packages

## 1.4.0

### Minor Changes

- afcd041: Refactor of error objects for better serialization in worker and CLI

## 1.3.0

### Minor Changes

- e8fc192: autoinstall returns mapped specifiers to the caller

### Patch Changes

- e8fc192: Add support for @next and @latest tags

## 1.2.0

### Minor Changes

- Enable a step to have multiple inputs

## 1.1.3

### Patch Changes

- Don't default the run timeout

## 1.1.2

### Patch Changes

- cecdb60: Support an end step option

## 1.1.1

### Patch Changes

- Updated dependencies [2fde0ad]
  - @openfn/logger@1.0.1

## 1.1.0

### Minor Changes

- 4f5f1dd: Support workflows with different versions of the same adaptor

## 1.0.0

### Major Changes

- 86dd668: The 1.0 release of the runtime updates the signatures and language of the runtime to match Lightning. It also includes some housekeeping.

  - Update main run() signature
  - Remove strict mode options
  - Integrate with lexicon

### Patch Changes

- Updated dependencies [649ca43]
- Updated dependencies [9f6c35d]
- Updated dependencies [86dd668]
  - @openfn/logger@1.0.0

## 0.2.6

### Patch Changes

- Updated dependencies [649ca43]
  - @openfn/logger@0.0.20

## 0.2.5

### Patch Changes

- 0f22694: Accept the linker's whitelist as strings
- ignore timeout if it has a value of 0 or false

## 0.2.4

### Patch Changes

- 6ca87a1: Remove deleteConfiguration option
- 56b6e44: Add statePropsToRemove option

## 0.2.3

### Patch Changes

- f228fd5: Add edge evaluation logging to runtime

## 0.2.2

### Patch Changes

- 02ab459: Warn if a non-leaf job does not return state

## 0.2.1

### Patch Changes

- Report on memory usage at the end of job

## 0.2.0

### Minor Changes

- 40ffc22: Allow globals to be passed into the execution environment

## 0.1.4

### Patch Changes

- 857c42b: Fix log output for job duration

## 0.1.3

### Patch Changes

- 7f352d2: Broadcast next steps with job-complete and error events

## 0.1.2

### Patch Changes

- 419f276: Clean state after error
- 0e66f5a: Rename JobError to JobError

## 0.1.1

### Patch Changes

- c448a23: Fix an issue where expression result state is not serialized before being broadcast, causing blowups

## 0.1.0

### Minor Changes

- a540888: Allow to crash on error
  Start fine-tuning error handling

## 0.0.33

### Patch Changes

- Removed log line
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
