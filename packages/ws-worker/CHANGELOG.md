# ws-worker

## 0.2.10

### Patch Changes

- 30da946: Better conversion of edge conditions to only take the upstream job into account
- c1aa9b3: Leave attempt queue channel on disconnect
  Allow outstanding work to finish before closing down on SIGTERM
- 60b6fba: Add a healthcheck at /livez and respond with 200 at root
- Updated dependencies [a6dd44b]
  - @openfn/engine-multi@0.2.1

## 0.2.9

### Patch Changes

- 54d0017: Start ws-worker using node (not pnpm) by default
- 6f78b7a: Add env var for WORKER_REPO_DIR
- Updated dependencies [4a17048]
  - @openfn/engine-multi@0.2.0
  - @openfn/runtime@0.2.0

## 0.2.8

### Patch Changes

- Tweak typings

## 0.2.7

### Patch Changes

- d542aa9: worker: leave attempt channel when finished working
- Updated dependencies [793d523]
- Updated dependencies [857c42b]
- Updated dependencies [f17fb4a]
  - @openfn/engine-multi@0.1.11
  - @openfn/runtime@0.1.4

## 0.2.6

### Patch Changes

- 0fb2d58: correctly handle input_dataclip_id for runs
- Updated dependencies [c8e9d51]
- Updated dependencies [7f352d2]
  - @openfn/engine-multi@0.1.10
  - @openfn/runtime@0.1.3

## 0.2.5

### Patch Changes

- 36337d7: When calculating exit reasons, exclude non-executed downstream nodes in leaf calculation. (i.e., look at the final executed node in each branch when determining the attempt exit reason.)

## 0.2.4

### Patch Changes

- Updated dependencies [419f276]
- Updated dependencies [0e66f5a]
  - @openfn/runtime@0.1.2
  - @openfn/engine-multi@0.1.9

## 0.2.3

### Patch Changes

- 7d350d9: Only consider leaf nodes when calculating attempt fail reasons

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
