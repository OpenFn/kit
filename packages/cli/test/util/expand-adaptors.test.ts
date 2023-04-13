import test from 'ava';
import expandAdaptors from '../../src/util/expand-adaptors';

test('expands common', (t) => {
  const { adaptors } = expandAdaptors({ adaptors: ['common'] });
  t.is(adaptors![0], '@openfn/language-common');
});

test('expands common with version', (t) => {
  const { adaptors } = expandAdaptors({ adaptors: ['common@1.0.0'] });
  t.is(adaptors![0], '@openfn/language-common@1.0.0');
});

test('expands common with path', (t) => {
  const { adaptors } = expandAdaptors({ adaptors: ['common=a/b/c'] });
  t.is(adaptors![0], '@openfn/language-common=a/b/c');
});

test('expands http and dhis2', (t) => {
  const { adaptors } = expandAdaptors({ adaptors: ['common', 'dhis2'] });
  const [a, b] = adaptors!;
  t.is(a, '@openfn/language-common');
  t.is(b, '@openfn/language-dhis2');
});

test('expands nonsense', (t) => {
  const { adaptors } = expandAdaptors({ adaptors: ['gn@25~A8fa1'] });
  t.is(adaptors![0], '@openfn/language-gn@25~A8fa1');
});

test('does not expand a full adaptor name', (t) => {
  const { adaptors } = expandAdaptors({
    adaptors: ['@openfn/language-common'],
  });
  t.is(adaptors![0], '@openfn/language-common');
});

test('does not expand a full adaptor name with a path', (t) => {
  const { adaptors } = expandAdaptors({
    adaptors: ['@openfn/language-common=a/b/c'],
  });
  t.is(adaptors![0], '@openfn/language-common=a/b/c');
});

test('does not expand a simple path', (t) => {
  const { adaptors } = expandAdaptors({ adaptors: ['a/b'] });
  t.is(adaptors![0], 'a/b');
});

test('does not expand an absolute path', (t) => {
  const { adaptors } = expandAdaptors({ adaptors: ['/a/b/c'] });
  t.is(adaptors![0], '/a/b/c');
});

test('does not expand a js file', (t) => {
  const { adaptors } = expandAdaptors({ adaptors: ['my-adaptor.js'] });
  t.is(adaptors![0], 'my-adaptor.js');
});

test('expands adaptors in a workflow', (t) => {
  const workflow = {
    start: 'a',
    jobs: {
      a: {
        adaptor: 'common',
        expression: 'fn()',
      },
      b: {
        adaptor: 'http@1.0.0',
        expression: 'fn()',
      },
      c: {
        adaptor: 'salesforce=a/b/c',
        expression: 'fn()',
      },
      d: {
        adaptor: 'a/b/c/my-adaptor.js',
        expression: 'fn()',
      },
    },
  };
  const newOpts = expandAdaptors({ workflow });
  t.is(newOpts.workflow.jobs.a.adaptor, '@openfn/language-common');
  t.is(newOpts.workflow.jobs.b.adaptor, '@openfn/language-http@1.0.0');
  t.is(newOpts.workflow.jobs.c.adaptor, '@openfn/language-salesforce=a/b/c');
  t.is(newOpts.workflow.jobs.d.adaptor, 'a/b/c/my-adaptor.js');
});
