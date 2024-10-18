import test from 'ava';
import { ExecutionPlan, Job } from '@openfn/lexicon';

import { parseAdaptors } from '../../src/execute/execute';

const createPlan = (adaptor: string): ExecutionPlan => ({
  workflow: {
    steps: [
      {
        adaptors: [adaptor],
        expression: '.',
      },
    ],
  },
  options: {},
});

test('parse a simple specifier with no path or version', (t) => {
  const adaptor = 'a';
  const plan = createPlan(adaptor);
  const result = parseAdaptors(plan);

  t.deepEqual(result, { a: {} });
});

test('parse a specifier with a path', (t) => {
  const adaptor = 'a=x';
  const plan = createPlan(adaptor);
  const result = parseAdaptors(plan);

  t.deepEqual(result, { a: { path: 'x' } });
});

test('parse a specifier with a version', (t) => {
  const adaptor = 'a@1';
  const plan = createPlan(adaptor);
  const result = parseAdaptors(plan);

  t.deepEqual(result, { a: { version: '1' } });
});

test('parse a specifier with a path and version', (t) => {
  const adaptor = 'a@1=x';
  const plan = createPlan(adaptor);
  const result = parseAdaptors(plan);

  t.deepEqual(result, { a: { path: 'x', version: '1' } });
});

test('parse @openfn/language-common@1.0.0=~/repo/modules/common', (t) => {
  const adaptor = '@openfn/language-common@1.0.0=~/repo/modules/common';
  const plan = createPlan(adaptor);
  const result = parseAdaptors(plan);

  t.deepEqual(result, {
    '@openfn/language-common': {
      path: '~/repo/modules/common',
      version: '1.0.0',
    },
  });
});

test('parse plan with several steps', (t) => {
  const plan = {
    options: {
      start: 'a',
    },
    workflow: {
      steps: [
        {
          adaptor: '@openfn/language-common',
          expression: 'fn()',
        },
        {
          adaptor: '@openfn/language-http@1.0.0',
          expression: 'fn()',
        },
        {
          adaptor: '@openfn/language-salesforce=a/b/c',
          expression: 'fn()',
        },
      ],
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
