# Implementation plan: editable collections in openfn.yaml

Issue: https://github.com/OpenFn/kit/issues/1418
Branch: `feat/1418-project-collections`

## Scope

In scope: let a user add/remove Lightning **collections** by hand-editing the
checked-out project's `openfn.yaml`, and have `openfn project deploy` create
and delete them accordingly.

Out of scope (deliberately):
- **Channels.** Same underlying gap, but channels carry more fields
  (`destination_url`, `enabled`, `destination_credential`) and syncing them
  safely needs its own design pass. Not touched here.
- **`openfn collections` command** (`packages/cli/src/collections/`). That's
  the runtime key-value-store feature used inside job execution
  (`collections.get`/`collections.set`). Unrelated feature, same word. Not
  touched here.
- Renaming a collection. Editing a name locally is treated as delete-old +
  create-new. This matches the legacy `packages/deploy` behavior already
  shipped, so it's not a regression.

## Where the data lives

`openfn.yaml`, under the existing `project:` key, as a plain array of names —
no ids, no uuids (those belong to the server, not the user):

```yaml
project:
  uuid: 91e9906a-28b9-4497-9d5f-22b64a55c8dd
  endpoint: http://localhost:4000
  id: sandbox-test
  name: sandbox-test
  collections:
    - my-collection
    - another-collection
```

`ProjectSpec.collections?: string[]` in `packages/lexicon/portability.d.ts`
already has this exact shape — no lexicon change needed there.

## Current state (why this doesn't work today)

- `collections` is already a first-class field on `Project`
  (`packages/project/src/Project.ts`) and already flows correctly through
  `fetch` → `.projects/<alias>.yaml` (the read-only cache) via
  `from-app-state.ts` / `to-project.ts`.
- `checkout` expands that cache into `workflows/**` + `openfn.yaml`
  (`serialize/to-fs.ts` → `util/config.ts#extractConfig`). `extractConfig`
  only writes `openfn`, `id`, `name`, `forked_from` into the `project:`
  block — `collections` is dropped here. This is the actual gap.
- `deploy` loads the checked-out project via `Project.from('fs', ...)`
  (`parse/from-fs.ts#parseProject`), which never sets `proj.collections` at
  all. So local edits are structurally impossible today, independent of the
  merge logic.
- `merge-project.ts` currently does `source.collections ?? target.collections`
  in `REPLACE_MERGE` mode — a naive whole-array passthrough that only "works"
  today because `source.collections` is always `undefined`. In
  `SANDBOX_MERGE` mode it's worse: `collections` isn't set in `assigns` at
  all, but `baseMerge`'s `pick(source, ['collections', 'channels'])` still
  copies `collections: undefined` as an own property, which overwrites
  `target`'s real collections in `Object.assign`. Confirmed by direct
  execution against the built package.

## Wire contract (verified against Lightning)

Confirmed against `OpenFn/lightning`'s `test/lightning/projects/provisioner_test.exs`
(`Provisioner.import_document/3`, which uses `cast_assoc(:collections, ...)`):

- The `collections` array in the deploy payload must be a **complete
  enumeration** of desired state, not a partial patch — every collection to
  keep must be listed (with its real `id`), every one to remove must be
  listed with `delete: true`. Omitting an existing collection from the array
  entirely is not exercised by their tests and shouldn't be relied on.
- Create: `{"id": "<client-generated-uuid>", "name": "<name>"}`
- Keep/update: `{"id": "<existing-id>", "name": "<name>"}` (name optional on
  keep, required-in-practice on rename since rename isn't supported here)
- Delete: `{"id": "<existing-id>", "delete": true}` (name not required)

This matches `packages/deploy/src/stateTransform.ts`'s existing, shipped
`CollectionState` shape (`{id, name, delete?}`) — same contract, just
re-implemented on the v2 side.

## File-by-file changes

### 1. `packages/lexicon/lightning.d.ts`
Tighten `Provisioner.Project.collections: any[]` (marked `// this is clearly
wrong?` in the source) to `Collection[]`, using the already-defined-but-unused
`Provisioner.Collection` type (`{id: string; name: string; delete?: boolean}`).
Pure type cleanup, no behavior change.

### 2. `packages/project/src/parse/from-fs.ts` (`parseProject`) — READ side
Currently:
```ts
openfn: omit(context.project, ['id', 'forked_from']),
```
This means `collections` would currently land inside `proj.openfn` (wrong
place) rather than being dropped — but nothing reads it out from there today
so it's effectively inert. Fix:
```ts
openfn: omit(context.project, ['id', 'forked_from', 'collections']),
collections: context.project.collections,
```
This is the missing "read `openfn.yaml` into `Project.collections`" step —
the load-bearing change that makes local edits visible at all.

### 3. `packages/project/src/util/config.ts` (`extractConfig`) — WRITE side
Currently builds:
```ts
const project: any = { ...(source.openfn || {}), id: source.id };
if (source.name) project.name = source.name;
if (source.cli.forked_from && ...) project.forked_from = source.cli.forked_from;
```
Add:
```ts
if (source.collections?.length) {
  project.collections = source.collections;
}
```
This is called from `serialize/to-fs.ts` on `checkout`/`pull`, so a freshly
checked-out or re-checked-out project will now show its real collections in
`openfn.yaml`, ready to edit.

### 4. `packages/project/src/merge/merge-collections.ts` (NEW)
New file, mirroring the existing one-concern-per-file pattern in
`packages/project/src/merge/` (see `merge-workflow.ts`).

```ts
import { randomUUID } from 'node:crypto';
import { Provisioner } from '@openfn/lexicon/lightning';

// source: local names (from openfn.yaml, user-edited, no ids)
// target: remote collections (freshly fetched, real ids)
export function mergeCollections(
  source: string[] = [],
  target: Provisioner.Collection[] = []
): Provisioner.Collection[] {
  const targetByName = new Map(target.map((c) => [c.name, c]));
  const result: Provisioner.Collection[] = [];

  for (const name of source) {
    const existing = targetByName.get(name);
    if (existing) {
      result.push({ id: existing.id, name });
      targetByName.delete(name);
    } else {
      result.push({ id: randomUUID(), name });
    }
  }

  // anything left in targetByName was removed locally
  for (const remaining of targetByName.values()) {
    result.push({ id: remaining.id, name: remaining.name, delete: true });
  }

  return result;
}
```

### 5. `packages/project/src/merge/merge-project.ts`
Two changes, both scoped to `collections` only (leave `channels`' existing
behavior untouched — that's a pre-existing, separate issue, see below):

a) Remove `'collections'` from the hardcoded `baseMerge` pick list so
   `pickedSource` never silently carries `collections: undefined`:
   ```ts
   baseMerge(target, source, ['channels'], assigns as any)
   ```
   (was `['collections', 'channels']`)

b) Set `assigns.collections` explicitly in **both** merge modes, since it now
   needs mode-specific handling:
   - `SANDBOX_MERGE`: `collections: target.collections` — unchanged
     pass-through. Sandbox mode merges *workflow content* into a different
     target project and deliberately ignores the source's project-level
     identity/settings (see the existing `name`/`description`/`openfn`
     omission in this branch) — collections should follow the same rule, or
     a local `openfn.yaml` could accidentally delete another project's real
     collections it doesn't happen to list.
   - `REPLACE_MERGE`: `collections: mergeCollections(source.collections, target.collections)`

### 6. `packages/project/src/serialize/to-app-state.ts`
No change needed. It already does
`pick(project, ['name', 'description', 'collections', 'channels'])` then
`omitBy(isNil)`. Once `merged.collections` is reliably a well-formed array in
both merge modes (per change 5), this already serializes correctly into the
deploy payload.

### 7. CLI (`packages/cli/src/projects/*`)
No changes anticipated. `checkout`/`pull`/`deploy` already call through the
`@openfn/project` functions above; there's no new flag or subcommand — this
is purely file-based editing. Confirmed today there are zero
collections/channels references anywhere in `packages/cli/src/projects/`.

## Known pre-existing bug, flagged but not fixed here

`merge-project.ts`'s `SANDBOX_MERGE` path has the same "silently wipes to
undefined" bug for **channels** that collections has today. Change 5a above
only removes `'collections'` from the pick list, so `channels` keeps its
current (buggy) behavior. Recommend filing this as a separate follow-up
issue rather than fixing it here, since fixing it properly means deciding
channels' merge semantics — which is explicitly out of scope for this piece
of work.

## Tests

- `packages/project/test/parse/from-fs.test.ts` — `openfn.yaml` with
  `project.collections` round-trips into `Project.collections`.
- `packages/project/test/serialize/to-fs.test.ts` — a `Project` with
  `collections` set writes them into `openfn.yaml`'s `project:` block; a
  project with an empty/absent list writes no `collections` key.
- `packages/project/test/merge/merge-collections.test.ts` (new) — unit
  tests for `mergeCollections`: new local name → create with fresh uuid;
  matching name → keeps target's id; name removed locally → `delete: true`;
  empty source with existing target → all deleted; empty everything → `[]`.
- `packages/project/test/merge/merge-project.test.ts` — add cases:
  `REPLACE_MERGE` diffs collections correctly; `SANDBOX_MERGE` leaves
  target's collections untouched even when source has none/different.
- `packages/cli/test/projects/checkout.test.ts` — checking out a project
  with server-side collections produces an `openfn.yaml` containing them.
- `packages/cli/test/projects/deploy.test.ts` — edit `openfn.yaml`'s
  `collections` list (add one, remove one) and confirm the payload posted to
  the mock Lightning server contains the correct create/delete entries.

## Docs

- `.claude/yaml-formats.md` doesn't mention `collections`/`channels` in
  either format's example today. Add a short note + the `project.collections`
  example under the v2 section.

## Open questions for you before/while implementing

1. Should `openfn project deploy`'s dry-run diff output (`printRichDiff` /
   `diff.ts`) call out collection creates/deletes explicitly, or is it fine
   for now if they're silent until the actual deploy? Not in the plan above;
   easy to add as a follow-up if you want it in v1 of this feature.
2. Should the CLI validate collection names locally (e.g. reject duplicates
   in the local list) before deploy, or just let Lightning's changeset
   validation reject bad input and surface that error? Plan above assumes
   the latter (no new local validation) to keep the change small.
3. Lightning enforces a collection-creation limit tied to plan/usage
   (`provisioner.ex`'s `limit_collection_creation`). Worth confirming with
   Brandon's team whether that error comes back in a form `deploy` can
   surface cleanly, or whether the CLI needs special-case handling.

## Changeset

One line, per house style: `CLI: support adding/removing project collections
via openfn.yaml`.
