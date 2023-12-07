import test from 'ava';

import calculateVersionString from '../../src/util/versions';

// keys in this obejct are scrambled on purpose
const versions = {
  worker: '2',
  compiler: '4',
  node: '1',
  engine: '3',
};

// Util function to parse a version string into something easier to test
// This purposefully makes a lot of assumptions about the shape of the string!
const parse = (str: string) => {
  const lines = str.split('\n');
  lines.shift(); // remove the "Versions:" line
  return lines.map((l) =>
    // remove indent
    l
      .trim()
      // remove special char and space
      .substring(2)
      // split into a tuple on whitespace
      .split(/\s+/)
  );
};

test('calculate version string', (t) => {
  const str = calculateVersionString('run-1', versions);
  // Formatting is super fussy in this test but it's sort of OK
  t.is(
    str,
    `run-1 versions:
      ▸ node.js     1
      ▸ worker      2
      ▸ engine      3
      ▸ compiler    4`
  );
});

test('helper should parse a version string and return the correct order', (t) => {
  const str = calculateVersionString('run-1', versions);

  const parsed = parse(str);
  t.deepEqual(parsed, [
    ['node.js', '1'],
    ['worker', '2'],
    ['engine', '3'],
    ['compiler', '4'],
  ]);
});

test("show unknown if a version isn't passed", (t) => {
  // @ts-ignore
  const str = calculateVersionString('run-1', {});

  const parsed = parse(str);
  t.deepEqual(parsed, [
    ['node.js', 'unknown'],
    ['worker', 'unknown'],
    ['engine', 'unknown'],
    ['compiler', 'unknown'],
  ]);
});

test('show adaptors last', (t) => {
  const str = calculateVersionString('run-1', {
    '@openfn/language-common': '1.0.0',
    ...versions,
  });

  const parsed = parse(str);
  const common = parsed[4];
  t.deepEqual(common, ['@openfn/language-common', '1.0.0']);
});

test('sort and list multiple adaptors', (t) => {
  const str = calculateVersionString('run-1', {
    j: '2',
    z: '3',
    a: '1',
    ...versions,
  });

  const parsed = parse(str);

  const a = parsed[4];
  const j = parsed[5];
  const z = parsed[6];

  t.deepEqual(a, ['a', '1']);
  t.deepEqual(j, ['j', '2']);
  t.deepEqual(z, ['z', '3']);
});
