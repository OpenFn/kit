import test from 'ava';
import slugify from '../../src/util/slugify';

test('lowercase the name', (t) => {
  t.is(slugify('ABC'), 'abc');
});

test('replace a space with a hyphen', (t) => {
  t.is(slugify('a b c'), 'a-b-c');
});

test('trim leading and trailing whitespace', (t) => {
  t.is(slugify('  my workflow  '), 'my-workflow');
});

test('keep existing hyphens and underscores', (t) => {
  t.is(slugify('my-work_flow'), 'my-work_flow');
});

test('keep punctuation', (t) => {
  t.is(
    slugify('Event-based workflow 1 (rename)'),
    'event-based-workflow-1-(rename)'
  );
});

test('keep accented letters', (t) => {
  t.is(slugify('Flujo de atención'), 'flujo-de-atención');
});

test('keep letters in other scripts', (t) => {
  t.is(slugify('患者確認'), '患者確認');
});

test('replace characters that are unsafe in file names', (t) => {
  t.is(slugify('a/b\\c:d*e?f"g<h>i|j'), 'a-b-c-d-e-f-g-h-i-j');
});

test('replace a leading dot', (t) => {
  t.is(slugify('.hidden'), '-hidden');
});

test('keep a dot that is not leading', (t) => {
  t.is(slugify('v2.0'), 'v2.0');
});

test('normalize to NFC', (t) => {
  // "e" followed by a combining acute accent
  const decomposed = 'café';
  t.is(slugify(decomposed), 'café');
});

test('return an empty string for an undefined name', (t) => {
  t.is(slugify(undefined as any), '');
});

test('replace each file-unsafe character on its own', (t) => {
  for (const char of ['/', '\\', ':', '*', '?', '"', '<', '>', '|']) {
    t.is(slugify(`a${char}b`), 'a-b', `failed for ${char}`);
  }
});

test('replace tabs and newlines with a hyphen', (t) => {
  t.is(slugify('a\tb\nc'), 'a-b-c');
});

test('replace a non-breaking space with a hyphen', (t) => {
  t.is(slugify('a b'), 'a-b');
});

// Each whitespace character becomes its own hyphen (runs are not collapsed)
test('replace each space in a run of spaces', (t) => {
  t.is(slugify('a  b'), 'a--b');
});

test('only replace the first of several leading dots', (t) => {
  t.is(slugify('..hidden'), '-.hidden');
});

test('replace a name that is just a dot', (t) => {
  t.is(slugify('.'), '-');
});

test('return an empty string for an empty name', (t) => {
  t.is(slugify(''), '');
});

test('return an empty string for a name that is only whitespace', (t) => {
  t.is(slugify('   '), '');
});

test('lowercase letters in other scripts', (t) => {
  t.is(slugify('ÜBER'), 'über');
  t.is(slugify('ПРИВЕТ МИР'), 'привет-мир');
  t.is(slugify('ΑΘΗΝΑ'), 'αθηνα');
});

test('keep emoji', (t) => {
  t.is(slugify('Deploy 🚀'), 'deploy-🚀');
});

test('keep an already composed name unchanged', (t) => {
  t.is(slugify('café'), 'café');
});

test('is idempotent', (t) => {
  for (const name of [
    'My Workflow',
    'Flujo de atención (v2.0)',
    '患者確認',
    '.hidden',
    'a/b:c',
  ]) {
    const once = slugify(name);
    t.is(slugify(once), once, `failed for ${name}`);
  }
});

test('names that differ only by case resolve to the same id', (t) => {
  t.is(slugify('Foo Bar'), slugify('foo bar'));
});

test('names that differ only by space vs hyphen resolve to the same id', (t) => {
  t.is(slugify('Foo Bar'), slugify('foo-bar'));
});

test('names that differ only by a replaced character resolve to the same id', (t) => {
  t.is(slugify('Q3/Q4'), slugify('Q3:Q4'));
});

test('names that differ only by a leading dot resolve to the same id', (t) => {
  t.is(slugify('.foo'), slugify('-foo'));
});

test('names with different punctuation resolve to different ids', (t) => {
  t.not(slugify('Workflow 1 (rename)'), slugify('Workflow 1 rename'));
});

// Known limits: these are not handled yet
test.todo('replace Windows reserved names (CON, NUL)');
test.todo('replace a trailing dot');
