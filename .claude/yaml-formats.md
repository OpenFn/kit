# OpenFn Project YAML Formats

Two YAML formats are used across the monorepo. The key distinction: **v1** uses objects keyed by ID; **v2** uses arrays.

## v1 (Lightning app state)

Used by `packages/deploy` and sent to/from the Lightning API (`Provisioner.Project` type from `@openfn/lexicon/lightning`).

- `workflows` is a keyed object (`{ [slug]: Workflow }`)
- Each workflow has `jobs`, `triggers`, and `edges` as keyed objects
- Steps are called `jobs`; code is stored in `body`
- Credentials referenced by UUID (`project_credential_id`)
- No version marker — absence of `schema_version`/`cli.version` means v1

```yaml
id: abc-123
name: My Project
project_credentials:
  - id: cred-uuid
    name: My Credential
    owner: admin@openfn.org
workflows:
  my-workflow:
    id: wf-uuid
    name: My Workflow
    jobs:
      transform-data:
        id: job-uuid
        name: Transform data
        body: 'fn(s => s)'
        adaptor: '@openfn/language-common@latest'
        project_credential_id: cred-uuid
        keychain_credential_id: null
    triggers:
      webhook:
        id: trig-uuid
        type: webhook
        enabled: true
    edges:
      trigger->transform-data:
        id: edge-uuid
        enabled: true
        source_trigger_id: trig-uuid
        target_job_id: job-uuid
```

## v2 (local project state)

Used by `packages/project` and the CLI project subcommands (`ProjectState` type from `@openfn/lexicon`).

- Identified by `schema_version` field (current: `'4.0'`) or legacy `cli.version: 2`
- `workflows` is an array
- Each workflow has a `steps` array; triggers are steps with a `type` field
- Code stored in `expression`; edges expressed inline via `next` map on each step
- Credentials referenced by name string (`configuration`)

```yaml
id: my-project
name: My Project
schema_version: '4.0'
credentials:
  - uuid: cred-uuid
    name: My Credential
    owner: admin@openfn.org
workflows:
  - id: my-workflow
    name: My Workflow
    start: webhook
    steps:
      - id: webhook
        type: webhook
        enabled: true
        next:
          transform-data:
            condition: always
      - id: transform-data
        name: Transform data
        expression: 'fn(s => s)'
        adaptor: '@openfn/language-common@latest'
        configuration: 'admin@openfn.org|My Credential'
```

## Detection logic

Use `detectVersion(data)` from `@openfn/project` — returns `1` or `2`. Accepts YAML/JSON string or pre-parsed object.

```typescript
import { detectVersion } from '@openfn/project';
if (detectVersion(json) === 2) { /* v2 */ }
```

## Conversion

- **v2 → v1**: `Project.from('project', json).then(p => p.serialize('state', { format: 'yaml' }))` — see `maybeConvertV2spec` in `packages/cli/src/deploy/handler.ts`
- **v1 → v2**: `Project.from('state', json)` — see `packages/project/src/parse/from-app-state.ts`
- Full conversion logic: `packages/project/src/serialize/to-app-state.ts` (v2→v1) and `packages/project/src/parse/from-app-state.ts` (v1→v2)
