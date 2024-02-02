import test from 'ava';

import { parseAdaptors } from '../../src/execute/execute';

// This is all useless now because we parse on an execution plan
// test('parse a simple specifier', (t) => {
//   const adaptors = ['a'];
//   const result = parseAdaptors({ adaptors });
//   t.assert(Object.keys(result).length === 1);
//   t.truthy(result.a);
//   t.falsy(Object.keys(result.a).length);
// });

// test('parse multiple specifiers', (t) => {
//   const adaptors = ['a', 'b'];
//   const result = parseAdaptors({ adaptors });
//   t.assert(Object.keys(result).length === 2);
//   t.truthy(result.a);
//   t.truthy(result.b);
// });

// test('parse a specifier with a path', (t) => {
//   const adaptors = ['a=x'];
//   const result = parseAdaptors({ adaptors });
//   t.assert(Object.keys(result).length === 1);
//   t.deepEqual(result.a, { path: 'x' });
// });

// test('parse a specifier with a version', (t) => {
//   const adaptors = ['a@1'];
//   const result = parseAdaptors({ adaptors });
//   t.assert(Object.keys(result).length === 1);
//   t.deepEqual(result.a, { version: '1' });
// });

// test('parse a specifier with a path and version', (t) => {
//   const adaptors = ['a@1=x'];
//   const result = parseAdaptors({ adaptors });
//   t.assert(Object.keys(result).length === 1);
//   t.deepEqual(result.a, { path: 'x', version: '1' });
// });

// test('parse @openfn/language-common@1.0.0=~/repo/modules/common', (t) => {
//   const adaptors = ['@openfn/language-common@1.0.0=~/repo/modules/common'];
//   const result = parseAdaptors({ adaptors });
//   t.assert(Object.keys(result).length === 1);
//   t.deepEqual(result, {
//     '@openfn/language-common': {
//       path: '~/repo/modules/common',
//       version: '1.0.0',
//     },
//   });
// });

test('parse plan', (t) => {
  const plan = {
    options: {
      start: 'a',
    },
    workflow: {
      // TODO oh no the workflow structure accepted by the CLI isa  bit different!
      // its an indexed object, rather than an array
      // no its not. it comes in as an array.
      // what is this structure?
      steps: [
        a: {
          adaptor: '@openfn/language-common',
          expression: 'fn()',
        },
        b: {
          adaptor: '@openfn/language-http@1.0.0',
          expression: 'fn()',
        },
        c: {
          adaptor: '@openfn/language-salesforce=a/b/c',
          expression: 'fn()',
        },
      },
    },
  };
  const result = parseAdaptors(plan);
  t.assert(Object.keys(result).length === 3);
  t.deepEqual(result, {
    '@openfn/language-common': {},
    '@openfn/language-http': {
      version: '1.0.0',
    },
    '@openfn/language-salesforce': {
      path: 'a/b/c',
    },
  });
});

// TODO we can't do this right now
// We'd have to send different maps to different jobs
// Which we can support but maybe I'm gonna push that out of scope
test.skip('parse workflow with multiple versions of the same adaptor', (t) => {
  const workflow = {
    start: 'a',
    jobs: {
      a: {
        adaptor: '@openfn/language-common@1.0.0',
        expression: 'fn()',
      },
      b: {
        adaptor: '@openfn/language-common@2.0.0',
        expression: 'fn()',
      },
    },
  };
});
