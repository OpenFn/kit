# Unit Testing Job Code

OpenFn job expressions are not valid JavaScript out of the box — top-level adaptor calls like `get('/endpoint')` prevent them from being imported directly into a test runner. Compiling them first solves this.

## Approach

1. Compile job expressions to standard JavaScript
2. Import compiled files in your test suite
3. Test any pure functions in isolation

## Compiling for Tests

`openfn compile` writes compiled output to `compiled/` by default. Use `--exports-only` to also strip adaptor operation calls, keeping only explicitly exported code.

```bash
# Compile all workflows in the project (full compilation, preserves operations)
openfn compile

# Compile all workflows, stripping operation calls (useful for unit testing)
openfn compile --exports-only

# Compile a single workflow by name
openfn compile my-workflow

# Compile a single workflow to a custom directory
openfn compile my-workflow -o tests/

# Compile a single job expression (prints to stdout)
openfn compile workflows/my-workflow/step-a.js --exports-only

# Watch mode: recompile whenever source files change
openfn compile --exports-only --watch
```

## What `--exports-only` keeps

`--exports-only` strips operation calls. Only explicitly exported declarations survive:

- `export const myHelper = ...` ✓
- `export function parseSms() {}` ✓
- `const helper = ...` (not exported) ✗ — dropped
- `fn(state => ...)` (operation call) ✗ — stripped

`export default` is removed in strip mode — it is only needed by the runtime, not for unit testing.

Steps with no exportable code (nothing is exported after stripping) are skipped — no file is written.

## Full compilation (no `--exports-only`)

Without `--exports-only`, the full compiled output is written — all declarations are preserved and operations are kept in `export default [op1, op2, ...]`:

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

**Compiled** (`compiled/dhis2-sync/transform.js`) after `openfn compile --exports-only`:

```js
import { dateFns } from '@openfn/language-dhis2';

export const formatDate = (date) => dateFns.format(date, 'yyyy-MM-dd');
```

The operation is stripped. `formatDate` survives because it is explicitly exported.

**Test** (using any test runner):

```js
// test/transform.test.js
import { formatDate } from '../compiled/dhis2-sync/transform.js';

test('formats a date correctly', () => {
  const result = formatDate(new Date('2024-01-15'));
  assert.equal(result, '2024-01-15');
});
```

## Project-wide Compilation

Running `openfn compile` with no path compiles every step in every workflow in the current project directory (must contain `openfn.yaml`).

Output layout:

```
compiled/
  my-workflow/
    step-a.js
    step-b.js
  another-workflow/
    step-c.js
```

Override the output directory with `-o <dir>`:

```bash
openfn compile --exports-only -o tests/
```

Configure default directories in `openfn.yaml`:

```yaml
dirs:
  workflows: workflows
  compiled: compiled # used by openfn compile
```

## Recommended Setup

**`package.json`** (in your OpenFn project):

```json
{
  "scripts": {
    "compile": "openfn compile --exports-only",
    "compile:watch": "openfn compile --exports-only --watch",
    "test": "node --test test/**/*.test.js"
  }
}
```

## Notes

- In `--exports-only` mode, only `export const` and `export function` declarations survive — non-exported helpers are always dropped
- Import statements are always preserved
- Without `--exports-only`, all code including operations is kept in `export default [...]`
- Watch mode reruns compilation on any source change, making the edit → test cycle fast
- Use `-O` to print compiled output to stdout instead of writing to disk
