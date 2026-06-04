# Unit Testing Job Code

OpenFn job expressions are not valid JavaScript out of the box — top-level adaptor calls like `get('/endpoint')` prevent them from being imported directly into a test runner. Compiling them first solves this.

## Approach

1. Compile job expressions to standard JavaScript
2. Import compiled files in your test suite
3. Test any pure functions in isolation

## Compiling for Tests

The `--test` flag writes compiled output to `tests/` by default. By default it also strips adaptor operation calls, keeping only explicitly exported code. Pass `--no-strip` to keep everything.

```bash
# Compile a single step (strips operations, writes to tests/)
openfn compile workflows/my-workflow/step-a.js --test

# Compile to a specific file
openfn compile workflows/my-workflow/step-a.js --test -o tests/step-a.js

# Compile all workflows in the project
openfn compile --test

# Compile without stripping — keeps operations and all declarations
openfn compile --test --no-strip

# Watch mode: recompile whenever source files change
openfn compile --test --watch
```

## What survives compilation (strip mode)

By default `--test` strips the code. Only explicitly exported declarations survive:

- `export const myHelper = ...` ✓
- `export function parseSms() {}` ✓
- `const helper = ...` (not exported) ✗ — dropped
- `fn(state => ...)` (operation call) ✗ — stripped

If an exported function depends on a non-exported local declaration, that dependency is kept automatically.

`export default` is removed in strip mode — it is only needed by the runtime, not for unit testing.

Steps with no exportable code (nothing is exported after stripping) are skipped — no file is written.

## What `--no-strip` keeps

With `--no-strip`, the full compiled output is written — all declarations are preserved and operations are kept in `export default [op1, op2, ...]`:

```js
import { post } from '@openfn/language-http';

export default [post('/endpoint', { data: state.data })];
```

All steps are written regardless of whether they export anything.

## Example: Testing a Helper Function

**Source** (`workflows/dhis2-sync/transform.js`):

```js
import { dateFns } from '@openfn/language-dhis2';

export const formatDate = (date) => dateFns.format(date, 'yyyy-MM-dd');

fn((state) => ({
  ...state,
  data: state.data.map((row) => ({
    ...row,
    date: formatDate(row.date),
  })),
}));
```

**Compiled** (`tests/dhis2-sync/transform.js`) after `openfn compile --test`:

```js
import { dateFns } from '@openfn/language-dhis2';

export const formatDate = (date) => dateFns.format(date, 'yyyy-MM-dd');
```

The operation is stripped. `formatDate` survives because it is explicitly exported.

**Test** (using any test runner):

```js
// test/transform.test.js
import { formatDate } from '../tests/dhis2-sync/transform.js';

test('formats a date correctly', () => {
  const result = formatDate(new Date('2024-01-15'));
  assert.equal(result, '2024-01-15');
});
```

## Project-wide Compilation

Running `openfn compile --test` with no path compiles every step in every workflow in the current project directory (must contain `openfn.yaml`).

Output layout:

```
tests/
  my-workflow/
    step-a.js
    step-b.js
  another-workflow/
    step-c.js
```

Override the output directory with `-o <dir>`:

```bash
openfn compile --test -o dist/tests
```

Configure default directories in `openfn.yaml`:

```yaml
dirs:
  workflows: workflows
  compiled: compiled # used by openfn compile (without --test)
  tests: tests # used by openfn compile --test
```

### Stale file cleanup

After each project-wide run in strip mode, any step file that was skipped (no exportable code) is automatically deleted from `tests/` if it exists from a previous run. Only files at exact step paths (`tests/<workflow-id>/<step-id>.js`) are touched — files you have added at other paths (e.g. `tests/my-workflow/helpers.js`) are never removed.

There is no option to wipe the entire `tests/` directory. To do a full reset, delete it manually before running `openfn compile --test`.

## Recommended Setup

**`package.json`** (in your OpenFn project):

```json
{
  "scripts": {
    "compile": "openfn compile --test",
    "compile:watch": "openfn compile --test --watch",
    "test": "node --test test/**/*.test.js"
  }
}
```

## Notes

- In strip mode, only `export const` and `export function` declarations survive — non-exported helpers are dropped unless referenced by an export
- Import statements are always preserved
- `--no-strip` keeps all code including operations in `export default [...]`
- Watch mode reruns compilation on any source change, making the edit → test cycle fast
