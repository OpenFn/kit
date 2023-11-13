# ws-worker

## 0.2.2

### Patch Changes

- ead672a: Fix credential mapping from Lightning
- Updated dependencies [c448a23]
  - @openfn/runtime@0.1.1
  - @openfn/engine-multi@0.1.8

## 0.2.1

### Patch Changes

- ad8f6e9: Improve robustness of server connectivity
- Updated dependencies [704e7b6]
  - @openfn/engine-multi@0.1.7

## 0.2.0

### Minor Changes

- 0e8e20c: BREAKING: Updated exit reasons to `{ reason: "success", error_type, error_message }`
  Add exit reasons to job and attempt complete

### Patch Changes

- Updated dependencies [a540888]
- Updated dependencies [0e8e20c]
  - @openfn/runtime@0.1.0
  - @openfn/engine-multi@0.1.6

## 0.1.8

### Patch Changes

- b8fd13d: Fix undefined log output

## 0.1.7

### Patch Changes

- 8f7f57b: Send timestamps as strings in microsecond precision
- Updated dependencies [ca701e8]
  - @openfn/logger@0.0.19
  - @openfn/engine-multi@0.1.5
  - @openfn/runtime@0.0.33

## 0.1.6

### Patch Changes

- 5037c68: Support maxWorkers flag
  Enforce minBackoff before claiming the next job
- Updated dependencies [ac7b0ca]
  - @openfn/engine-multi@0.1.4

## 0.1.5

### Patch Changes

- Test release

## 0.1.4

### Patch Changes

- Accept backoff as startup command

## 0.1.3

### Patch Changes

- Fix log event mapping
- Updated dependencies
  - @openfn/engine-multi@0.1.3

## 0.1.2

### Patch Changes

- f241348: Make destroy async
- Updated dependencies [d255f32]
- Updated dependencies [f241348]
  - @openfn/engine-multi@0.1.2

## 0.1.1

### Patch Changes

- Added docker image and bin stub
- Destroy workers on close
- Updated dependencies
  - @openfn/engine-multi@0.1.1

## 0.1.0

First release of the websocket worker, which handles comm between Lightning and the multi-threaded engine.

Features:

- Websocket integration with JWT auth
- Eventing between Lightning and the Worker
- Eventing between the Worker and the Engine
- Placeholder exit reasons
