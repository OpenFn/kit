# engine-multi

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
