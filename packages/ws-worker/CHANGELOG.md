# ws-worker

## 1.7.1

### Patch Changes

- 1c79dc1: Append the collections adaptor to steps that need it
- b15f151: Update worker to use adaptors as an array on xplans. Internal only change.
- Updated dependencies [3463ff9]
- Updated dependencies [7245bf7]
  - @openfn/runtime@2.0.0
  - @openfn/engine-multi@1.4.0

## 1.7.0

### Minor Changes

- ae55a6a: Include timestamp on step complete even if the step failed

### Patch Changes

- Updated dependencies [ae55a6a]
  - @openfn/engine-multi@1.3.0

## 1.6.7

### Patch Changes

- 42883f8: Better handliung of claim backoffs when at capacity

## 1.6.6

### Patch Changes

- Log claim event duration

## 1.6.5

### Patch Changes

- 5db5862: Dont log compiled job code
- f581c6b: log duration of runs and server capacity
- 3e6eba2: Trap errors coming out of the websocket
  - @openfn/engine-multi@1.2.5

## 1.6.4

### Patch Changes

- 0cf7198: Do not send the input_dataclip_id in step:start if the dataclip was witheld

## 1.6.3

### Patch Changes

Security update

- @openfn/engine-multi@1.2.4

## 1.6.2

### Patch Changes

security updates

## 1.6.1

### Patch Changes

- ca07db4: Fix an issue where a run with a missing start node caused the server to crash

## 1.6.0

### Minor Changes

- eaa3859: Include timestamps in key events

### Patch Changes

- Updated dependencies [870a836]
- Updated dependencies [44f7f57]
  - @openfn/engine-multi@1.2.2
  - @openfn/lexicon@1.1.0
  - @openfn/runtime@1.4.1

## 1.5.1

### Patch Changes

- a08fb47: Update CLI docs
  Add WORKER_MAX_SOCKET_TIMEOUT_SECONDS

## 1.5.0

### Minor Changes

- f363254: Allow a payload limit to be set for large dataclips and logs (payload_limit_mb)

## 1.4.1

### Patch Changes

- 2f5dc51: Update the compiler to treat method calls (http.get()) like operations
  - @openfn/engine-multi@1.2.1

## 1.4.0

### Minor Changes

- Allow operations to behave like promises (ie, support fn().then())

### Patch Changes

- Updated dependencies [40fd45b]
- Updated dependencies
  - @openfn/runtime@1.4.1
  - @openfn/engine-multi@1.2.0

## 1.3.0

### Minor Changes

- afcd041: Better error reporting in logs and on final state

### Patch Changes

- Updated dependencies [afcd041]
- Updated dependencies [afcd041]
- Updated dependencies [afcd041]
  - @openfn/runtime@1.4.0
  - @openfn/lexicon@1.0.2
  - @openfn/engine-multi@1.1.13

## 1.2.2

### Patch Changes

- @openfn/engine-multi@1.1.12

## 1.2.1

### Patch Changes

- @openfn/engine-multi@1.1.11

## 1.2.0

### Minor Changes

- e8fc192: Add support for @next and @latest tags in adaptor versions

### Patch Changes

- Updated dependencies [e8fc192]
- Updated dependencies [e8fc192]
- Updated dependencies [e8fc192]
  - @openfn/runtime@1.3.0
  - @openfn/engine-multi@1.1.10

## 1.1.11

### Patch Changes

- Enable a step to have multiple inputs
- Updated dependencies
  - @openfn/runtime@1.2.0
  - @openfn/engine-multi@1.1.9

## 1.1.10

### Patch Changes

- bc45b3d: Restructure handling of env vars

## 1.1.9

### Patch Changes

- Better error reporting for bad credentials
- Updated dependencies
  - @openfn/engine-multi@1.1.8

## 1.1.8

### Patch Changes

- Updated dependencies
  - @openfn/runtime@1.1.3
  - @openfn/engine-multi@1.1.7

## 1.1.7

### Patch Changes

- bdff4b2: Fix an issue where workers may not be returned to the pool if run:complete throws

## 1.1.6

### Patch Changes

- 2216720: Update lightning plan options to use snake case
- Updated dependencies [2216720]
  - @openfn/lexicon@1.0.1
  - @openfn/engine-multi@1.1.6
  - @openfn/runtime@1.1.2

## 1.1.5

### Patch Changes

- Updated dependencies
  - @openfn/engine-multi@1.1.5

## 1.1.4

### Patch Changes

- 7ddc5d8: Support expressions in lazy state operators
- 4deb5d4: Recognise import aliases in job code
- Updated dependencies [cecdb60]
  - @openfn/runtime@1.1.2
  - @openfn/engine-multi@1.1.4

## 1.1.3

### Patch Changes

- @openfn/engine-multi@1.1.3

## 1.1.2

### Patch Changes

- @openfn/engine-multi@1.1.2

## 1.1.1

### Patch Changes

- Updated dependencies [2fde0ad]
- Updated dependencies [2fde0ad]
  - @openfn/logger@1.0.1
  - @openfn/engine-multi@1.0.1
  - @openfn/lexicon@1.0.0
  - @openfn/runtime@1.0.1

## 1.0.0

### Major Changes

- 86dd668: The 1.0 release updates the language and input of the Worker to match the nomenclature of Lightning.

### Minor Changes

- 29bff41: Validate the run token

### Patch Changes

- a97eb26: Better error handling for invalid dataclips
- 823b471: Update handling of logs to accept stringified messages
- Updated dependencies
  - @openfn/engine-multi@1.0.0
  - @openfn/logger@1.0.0
  - @openfn/runtime@1.0.0
  - @openfn/lexicon@1.0.0

## 0.8.1

### Patch Changes

- 823b471: Update handling of logs to accept stringified messages
- Updated dependencies [649ca43]
- Updated dependencies [823b471]
  - @openfn/logger@0.0.20
  - @openfn/engine-multi@0.4.1
  - @openfn/runtime@0.2.6

## 0.8.0

### Minor Changes

- 7e4c159: Rename attempts to runs

### Patch Changes

- Updated dependencies [7e4c159]
  - @openfn/engine-multi@0.4.0

## 0.7.0

### Minor Changes

- 39af8e1: Ensure that we refer to the child of a 'run' (aka attempt) as a 'step'

## 0.6.0

### Patch Changes

- eb10b1f: Updated start env vars and arguments
- 281391b: Support attemptTimeoutMs in attempt options
  Better server logging at startup
  Support start arguments from the environment (but prefer CLI)
- 2857fe6: Send the exit reason to the attempt logs
- Updated dependencies [281391b]
  - @openfn/engine-multi@0.3.0

## 0.6.0

### Minor Changes

- 9b9ca0c: New worker pool engine

### Patch Changes

- Updated dependencies [0f22694]
- Updated dependencies [9b9ca0c]
  - @openfn/runtime@0.2.5
  - @openfn/engine-multi@0.3.0

## 0.5.0

### Minor Changes

- Add state-props-to-remove option
- Updated dependencies [56b6e44]
  - @openfn/engine-multi@0.2.6
  - @openfn/runtime@0.2.4

## 0.4.0

### Minor Changes

- f228fd5: Add support for initial edge conditions in worker

### Patch Changes

- Updated dependencies [f228fd5]
  - @openfn/runtime@0.2.3
  - @openfn/engine-multi@0.2.5

## 0.3.2

### Patch Changes

- Add git to worker image

## 0.3.1

### Patch Changes

- Don't log compiler and runtime version logs

## 0.3.0

### Minor Changes

- 419d310: Throttle attempt events to better preserve their sequencing

### Patch Changes

- 598c669: Make edge conditions more stable if state is not passed
- 6e906a7: Better handling of job-error
- Updated dependencies [02ab459]
  - @openfn/runtime@0.2.2
  - @openfn/engine-multi@0.2.4

## 0.2.12

### Patch Changes

- 6c3e9e42: Ensure capacity is also set on the engine
- Updated dependencies [05ccc10b]
- Updated dependencies [7235bf5e]
  - @openfn/engine-multi@0.2.3

## 0.2.11

### Patch Changes

- 22339c6: Add MAX_RUN_MEMORY env var and option to limit the memory available to each run
- 04ac3cc: Include duration and threadid in run-complete
- 340b96e: Send memory usage to lightning on run:complete
- Updated dependencies
  - @openfn/engine-multi@0.2.2
  - @openfn/runtime@0.2.1

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
