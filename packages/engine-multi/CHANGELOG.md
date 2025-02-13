# engine-multi

## 1.4.9

### Patch Changes

- Updated dependencies [beb4617]
  - @openfn/runtime@1.6.2

## 1.4.8

### Patch Changes

- Updated dependencies [70e3d7a]
  - @openfn/runtime@1.6.1

## 1.4.7

### Patch Changes

- Updated dependencies [4ddd4d6]
- Updated dependencies [93e9844]
- Updated dependencies [6e87156]
- Updated dependencies [aaa7e7b]
- Updated dependencies [4ddd4d6]
  - @openfn/runtime@1.6.0
  - @openfn/compiler@1.0.0
  - @openfn/logger@1.0.4
  - @openfn/lexicon@1.1.0

## 1.4.6

### Patch Changes

- Ensure support for node 18,20 and 22.

  This update ensures compatibility with node 18 LTS, 20 LTS, and 22.12.

  Most of the changes are in the build and test suites and have only minor impact on production code. No issues are anticipated as as result of this change.

  Prior releases may fail on node version >=20.

  Support for node 18 will be removed in late 2025.

- Updated dependencies
- Updated dependencies [8904af2]
  - @openfn/compiler@0.4.3
  - @openfn/runtime@1.5.4
  - @openfn/logger@1.0.3
  - @openfn/lexicon@1.1.0

## 1.4.5

### Patch Changes

- Updated dependencies
  - @openfn/compiler@0.4.2

## 1.4.4

### Patch Changes

- @openfn/compiler@0.4.1

## 1.4.3

### Patch Changes

- Updated dependencies [1cbbba0]
  - @openfn/runtime@1.5.3

## 1.4.2

### Patch Changes

- Updated dependencies [f6bd593]
  - @openfn/runtime@1.5.2

## 1.4.1

### Patch Changes

- Updated dependencies [eeb660d]
  - @openfn/runtime@1.5.1

## 1.4.0

### Minor Changes

- 7245bf7: Support multiple adaptors in job structures

### Patch Changes

- Engine: don't try to autoinstall adaptor versions with @local
- Updated dependencies [3463ff9]
- Updated dependencies [7a85894]
- Updated dependencies [b6de2c4]
  - @openfn/runtime@1.5.0
  - @openfn/compiler@0.4.0

## 1.3.0

### Minor Changes

- ae55a6a: Include timestamp on JOB_ERROR payload

## 1.2.5

### Patch Changes

- Updated dependencies [5db5862]
  - @openfn/compiler@0.3.3

## 1.2.4

### Patch Changes

- @openfn/compiler@0.3.2

## 1.2.3

### Patch Changes

- c3df1e5: Partially update vulnerable versions of braces - live-server is a holdout as there is not a newer version available.
- Updated dependencies [c3df1e5]
  - @openfn/compiler@0.3.1
  - @openfn/logger@1.0.2
  - @openfn/runtime@1.4.2
  - @openfn/lexicon@1.1.0

## 1.2.2

### Patch Changes

- 870a836: Add high resolution timestamps to key events
- Updated dependencies [44f7f57]
  - @openfn/lexicon@1.1.0
  - @openfn/runtime@1.4.1

## 1.2.1

### Patch Changes

- Updated dependencies [4751c90]
  - @openfn/compiler@0.3.0

## 1.2.0

### Minor Changes

- Allow operations to behave like promises (ie, support fn().then())

### Patch Changes

- Updated dependencies [40fd45b]
- Updated dependencies [40fd45b]
  - @openfn/compiler@0.2.0
  - @openfn/runtime@1.4.1

## 1.1.13

### Patch Changes

- afcd041: Remove the type key from errors
- Updated dependencies [afcd041]
- Updated dependencies [afcd041]
  - @openfn/runtime@1.4.0
  - @openfn/lexicon@1.0.2

## 1.1.12

### Patch Changes

- @openfn/compiler@0.1.4

## 1.1.11

### Patch Changes

- @openfn/compiler@0.1.3

## 1.1.10

### Patch Changes

- e8fc192: Adjust to new autoinstall api
- Updated dependencies [e8fc192]
- Updated dependencies [e8fc192]
  - @openfn/runtime@1.3.0

## 1.1.9

### Patch Changes

- Updated dependencies
  - @openfn/runtime@1.2.0

## 1.1.8

### Patch Changes

- Better error reporting for bad credentials

## 1.1.7

### Patch Changes

- Updated dependencies
  - @openfn/runtime@1.1.3

## 1.1.6

### Patch Changes

- Updated dependencies [2216720]
  - @openfn/lexicon@1.0.1
  - @openfn/runtime@1.1.2

## 1.1.5

### Patch Changes

- Fix an issue where failed steps might not error correctly, stopping the pool from reclaiming the slot

## 1.1.4

### Patch Changes

- Updated dependencies [cecdb60]
- Updated dependencies [7ddc5d8]
  - @openfn/runtime@1.1.2
  - @openfn/compiler@0.1.2

## 1.1.3

### Patch Changes

- Updated dependencies
  - @openfn/compiler@0.1.1

## 1.1.2

### Patch Changes

- Updated dependencies [6dcce3d]
- Updated dependencies [1d37ca1]
  - @openfn/compiler@0.1.0

## 1.1.1

### Patch Changes

- 2fde0ad: Slightly better error reporting for exceptions
- Updated dependencies [2fde0ad]
  - @openfn/logger@1.0.1
  - @openfn/compiler@0.0.41
  - @openfn/lexicon@1.0.0
  - @openfn/runtime@1.0.1

## 1.1.0

### Minor Changes

- 4f5f1dd: Support workflows with different versions of the same adaptor

### Patch Changes

- 58e0d11: Record adaptor versions as an array
- Updated dependencies [4f5f1dd]
  - @openfn/runtime@1.1.0

## 1.0.0

### Major Changes

- 86dd668: The 1.0 release updates the language and input of the Engine to match the nomenclature of Lightning.

### Patch Changes

- 5f24294: Don't log adaptor logs to stdout
- 823b471: Update handling of logs so that JSON messages are stringified
- ea6fc05: Add a CredentialLoadError
- Updated dependencies [649ca43]
- Updated dependencies [86dd668]
- Updated dependencies [9f6c35d]
- Updated dependencies [86dd668]
  - @openfn/logger@1.0.0
  - @openfn/runtime@1.0.0
  - @openfn/compiler@0.0.40
  - @openfn/lexicon@1.0.0

## 0.4.1

### Patch Changes

- 823b471: Update handling of logs so that JSON messages are stringified
- Updated dependencies [649ca43]
  - @openfn/logger@0.0.20
  - @openfn/compiler@0.0.39
  - @openfn/runtime@0.2.6

## 0.4.0

### Minor Changes

- 7e4c159: Rename attempts to runs

## 0.3.0

### Minor Changes

- 9b9ca0c: Replace workerpool with new child_process pool implementation
- 281391b: Replace timeout option with attemptTimeoutMs

### Patch Changes

- Updated dependencies [0f22694]
  - @openfn/runtime@0.2.5

## 0.2.6

### Patch Changes

- 5c45e1e: Remove response key from state
- Updated dependencies [56b6e44]
  - @openfn/runtime@0.2.4

## 0.2.5

### Patch Changes

- Updated dependencies [f228fd5]
  - @openfn/runtime@0.2.3

## 0.2.4

### Patch Changes

- Updated dependencies [02ab459]
  - @openfn/runtime@0.2.2

## 0.2.3

### Patch Changes

- 05ccc10b: Handle async errors in the runtime
- 7235bf5e: Throw a better error on process.exit

## 0.2.2

### Patch Changes

- 22339c6: Enforce memory limit on workflows
- 5991622: Include memory usage in job-complete events
- Updated dependencies
  - @openfn/runtime@0.2.1

## 0.2.1

### Patch Changes

- 5fdd699: Don't direct job logs to stdout
- a6dd44b: Allow graceful termination of worker threads

## 0.2.0

### Minor Changes

- 6f78b7a: Remove ENGINE_REPO_DIR - the repo must be passed directly now

### Patch Changes

- 4a17048: Queue autoinstall requests to ensure we only install one thing at a time
- Updated dependencies [40ffc22]
  - @openfn/runtime@0.2.0

## 0.1.11

### Patch Changes

- 793d523: Updated purge strategy
- f17fb4a: Better error handling in autoinstall
- Updated dependencies [857c42b]
  - @openfn/runtime@0.1.4

## 0.1.10

### Patch Changes

- c8e9d51: Forward next from job complete
- Updated dependencies [7f352d2]
  - @openfn/runtime@0.1.3

## 0.1.9

### Patch Changes

- Updated dependencies [419f276]
- Updated dependencies [0e66f5a]
  - @openfn/runtime@0.1.2

## 0.1.8

### Patch Changes

- Updated dependencies [c448a23]
  - @openfn/runtime@0.1.1

## 0.1.7

### Patch Changes

- 704e7b6: Use the runtime in non-strict mode

## 0.1.6

### Patch Changes

- 0e8e20c: Forward error events from the runtime
- Trap better errors
- Updated dependencies [a540888]
  - @openfn/runtime@0.1.0

## 0.1.5

### Patch Changes

- Updated dependencies [ca701e8]
  - @openfn/logger@0.0.19
  - @openfn/compiler@0.0.38
  - @openfn/runtime@0.0.33

## 0.1.4

### Patch Changes

- ac7b0ca: Add purge option

## 0.1.3

### Patch Changes

- Export event types

## 0.1.2

### Patch Changes

- d255f32: Defer execution to allow listeners to attach
- f241348: Make destroy async

## 0.1.1

### Patch Changes

- Destroy workers on close

## 0.1.0

First release of the multi-threaded runtime engine.

Features:

- Workerpool integration
- Isolated module loading with workflow id
- Timeout on the attempt
- Purging of threads while idle
- Autoinstall of modules
