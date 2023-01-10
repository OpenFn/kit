# @openfn/cli

## 0.0.26

### Patch Changes

- Updated dependencies
  - @openfn/compiler@0.0.23
  - @openfn/runtime@0.0.16

## 0.0.25

### Patch Changes

- Updated dependencies [986bf07]
- Updated dependencies [5c6fde4]
  - @openfn/runtime@0.0.15

## 0.0.24

### Patch Changes

- 74cc00f: Fix example display in docgen
- 8ccb78d: Hide docgen command
- 5d9dd10: Set job timeout through CLI
- c1e24a5: Fix an issue when running the docs command with no version number
- Updated dependencies [47ac1a9]
- Updated dependencies [1695874]
- Updated dependencies [74cc00f]
  - @openfn/runtime@0.0.14
  - @openfn/describe-package@0.0.14
  - @openfn/compiler@0.0.22

## 0.0.23

### Patch Changes

- b7265c8: Log version information
- Updated dependencies [454a06b]
  - @openfn/compiler@0.0.21

## 0.0.22

### Patch Changes

- Updated dependencies [1a2d04a]
  - @openfn/describe-package@0.0.13
  - @openfn/compiler@0.0.20

## 0.0.21

### Patch Changes

- 4442a41: Forward spawned child process exit code to CLI process on exit

## 0.0.20

### Patch Changes

- 8d0f029: Add docgen and docs commands
- 7571536: Fix hang on windows
- Updated dependencies [e95c133]
  - @openfn/logger@0.0.8
  - @openfn/compiler@0.0.19
  - @openfn/runtime@0.0.13

## 0.0.19

### Patch Changes

- @openfn/compiler@0.0.18

## 0.0.18

### Patch Changes

- 68b4208: Support circular structures in JSON output
  Introduce strict output (by default) which only serializes data
  Never serialize configuration to output
- Updated dependencies
  - @openfn/logger@0.0.7
  - @openfn/compiler@0.0.17
  - @openfn/runtime@0.0.12

## 0.0.17

### Patch Changes

- 7f68a40: Update global list
- Updated dependencies [7f68a40]
  - @openfn/compiler@0.0.16

## 0.0.16

### Patch Changes

- @openfn/compiler@0.0.15

## 0.0.15

### Patch Changes

- ba9bf80: Bug fixes
- Updated dependencies [ba9bf80]
- Updated dependencies [2d07777]
  - @openfn/runtime@0.0.11
  - @openfn/logger@0.0.6
  - @openfn/compiler@0.0.14

## 0.0.14

### Patch Changes

- @openfn/compiler@0.0.13

## 0.0.13

### Patch Changes

- ef9406b: Support auto-install of modules
- Updated dependencies
  - @openfn/logger@0.0.5
  - @openfn/runtime@0.0.10
  - @openfn/compiler@0.0.12

## 0.0.12

### Patch Changes

- 6d1d199: Support mutability in the runtime
- 41bdfdc: Don't try and import globals like Promise or Date
- 28168a8: Updated build process
- Updated dependencies
  - @openfn/runtime@0.0.9
  - @openfn/compiler@0.0.11
  - @openfn/logger@0.0.4

## 0.0.11

### Patch Changes

- Updated dependencies [1d293ae]
  - @openfn/compiler@0.0.10

## 0.0.10

### Patch Changes

- 92e5427: bump everything, npm package.json issues
- Updated dependencies [92e5427]
  - @openfn/compiler@0.0.9
  - @openfn/logger@0.0.3
  - @openfn/runtime@0.0.8

## 0.0.9

### Patch Changes

- Updated dependencies
  - @openfn/runtime@0.0.7

## 0.0.8

### Patch Changes

- Updated dependencies
  - @openfn/runtime@0.0.6

## 0.0.7

### Patch Changes

- f79bf9a: Added logger service to CLI, compiler and runtime
- Updated dependencies [f79bf9a]
  - @openfn/compiler@0.0.8
  - @openfn/logger@0.0.2
  - @openfn/runtime@0.0.5

## 0.0.6

### Patch Changes

- 5623913: Allow execute() function to be overriden by adaptors and jobs
- fb2b570: Fix version warning in cli
- Updated dependencies [5623913]
  - @openfn/compiler@0.0.7
  - @openfn/runtime@0.0.4

## 0.0.5

### Patch Changes

- 27c6434: Added a --test command to the cli
- 8a5311b: Added support for a --version flag in the cli
  - @openfn/compiler@0.0.6

## 0.0.4

### Patch Changes

- 8148cd5: Updated builds
- Updated dependencies [8148cd5]
  - @openfn/compiler@0.0.5
  - @openfn/runtime@0.0.3

## 0.0.3

### Patch Changes

- 3f6dc98: Initial release of new runtime, compiler and cli
- Updated dependencies [b5ce654]
- Updated dependencies [3f6dc98]
  - @openfn/runtime@0.0.2
  - @openfn/compiler@0.0.4
