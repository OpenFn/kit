import test from 'ava';
import expandAdaptors from '../../src/util/expand-adaptors';

test('expands common', (t) => {
  const adaptors = expandAdaptors(['common']) as string[];
  t.is(adaptors[0], '@openfn/language-common');
});

test('expands common with version', (t) => {
  const adaptors = expandAdaptors(['common@1.0.0']) as string[];
  t.is(adaptors[0], '@openfn/language-common@1.0.0');
});

test('expands common with path', (t) => {
  const adaptors = expandAdaptors(['common=a/b/c']) as string[];
  t.is(adaptors[0], '@openfn/language-common=a/b/c');
});

test('expands http and dhis2', (t) => {
  const adaptors = expandAdaptors(['common', 'dhis2']) as string[];
  const [a, b] = adaptors;
  t.is(a, '@openfn/language-common');
  t.is(b, '@openfn/language-dhis2');
});

test('expands nonsense', (t) => {
  const adaptors = expandAdaptors(['gn@25~A8fa1']) as string[];
  t.is(adaptors[0], '@openfn/language-gn@25~A8fa1');
});

test('does not expand a full adaptor name', (t) => {
  const adaptors = expandAdaptors(['@openfn/language-common']) as string[];
  t.is(adaptors[0], '@openfn/language-common');
});

test('does not expand a full adaptor name with a path', (t) => {
  const adaptors = expandAdaptors([
    '@openfn/language-common=a/b/c',
  ]) as string[];
  t.is(adaptors[0], '@openfn/language-common=a/b/c');
});

test('does not expand a simple path', (t) => {
  const adaptors = expandAdaptors(['a/b']) as string[];
  t.is(adaptors[0], 'a/b');
});

test('does not expand an absolute path', (t) => {
  const adaptors = expandAdaptors(['/a/b/c']) as string[];
  t.is(adaptors[0], '/a/b/c');
});

test('does not expand a js file', (t) => {
  const adaptors = expandAdaptors(['my-adaptor.js']) as string[];
  t.is(adaptors[0], 'my-adaptor.js');
});

test('expands adaptors in an execution plan', (t) => {
  const plan = {
    workflow: {
      steps: [
        {
          id: 'a',
          adaptor: 'common',
          expression: 'fn()',
        },
        {
          id: 'b',
          adaptor: 'http@1.0.0',
          expression: 'fn()',
        },
        {
          id: 'c',
          adaptor: 'salesforce=a/b/c',
          expression: 'fn()',
        },
        {
          id: 'd',
          adaptor: 'a/b/c/my-adaptor.js',
          expression: 'fn()',
        },
      ],
    },
    options: {},
  };
  expandAdaptors(plan);
  const [a, b, c, d] = plan.workflow.steps;
  t.is(a.adaptor, '@openfn/language-common');
  t.is(b.adaptor, '@openfn/language-http@1.0.0');
  t.is(c.adaptor, '@openfn/language-salesforce=a/b/c');
  t.is(d.adaptor, 'a/b/c/my-adaptor.js');
});
