# lexicon

## 1.2.7

### Patch Changes

- 72f18b1: Add a new project.yaml structure, which is the default "v2 state" used by each project. For now, this mirrors the internal structure of the runtime, rather than Lightning's structure

## 1.2.6

### Patch Changes

- Update types for projects

## 1.2.5

### Patch Changes

- 09dd4b2: - Add `final_state` object to `workflow:complete` event
  - Remove unused `final_dataclip_id` from `workflow:complete` payload

## 1.2.4

### Patch Changes

- 1f8d65e: Clarify naming conventions for id/name

## 1.2.3

### Patch Changes

- Update dependencies

## 1.2.2

### Patch Changes

- Sync types

## 1.2.1

### Patch Changes

- On claim, rename pod_name to worker_name

## 1.2.0

### Minor Changes

- 1857b46: Allow configuration of job log level

## 1.1.0

### Minor Changes

- 44f7f57: Bump API_VERSION to 1.2 (timestamps on events)

## 1.0.2

### Patch Changes

- afcd041: Add type for SerializedErrors and deprecate ErrorReport

## 1.0.1

### Patch Changes

- 2216720: Update lightning plan options to use snake case

## 1.0.0

### Major Changes

First release of the lexicon
