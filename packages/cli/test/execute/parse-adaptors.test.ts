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
          adaptors: ['@openfn/language-common'],
          expression: 'fn()',
        },
        {
          adaptors: ['@openfn/language-http@1.0.0'],
          expression: 'fn()',
        },
        {
          adaptors: ['@openfn/language-salesforce=a/b/c'],
          expression: 'fn()',
        },
      ],
    },
  };
  const result = parseAdaptors(plan);
  t.is(Object.keys(result).length, 3);
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
