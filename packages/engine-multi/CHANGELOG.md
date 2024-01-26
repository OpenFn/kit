# engine-multi

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
