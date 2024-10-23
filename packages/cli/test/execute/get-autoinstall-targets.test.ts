import test from 'ava';

import getAutoinstallTargets from '../../src/execute/get-autoinstall-targets';
import { ExecutionPlan, Job } from '@openfn/lexicon';

const getPlan = (steps: Job[]) =>
  ({
    workflow: {
      steps,
    },
    options: {},
  } as ExecutionPlan);

test('empty plan', (t) => {
  const plan = getPlan([]);
  const result = getAutoinstallTargets(plan);
  t.truthy(result);
  t.is(result.length, 0);
});

test('plan with zero adaptors', (t) => {
  const plan = getPlan([
    {
      expression: 'fn()',
    },
  ]);
  const result = getAutoinstallTargets(plan);
  t.truthy(result);
  t.is(result.length, 0);
});

test('plan with multiple adaptors in multiple steps', (t) => {
  const plan = getPlan([
    {
      adaptors: ['@openfn/language-common'],
      expression: 'fn()',
    },
    {
      adaptors: ['@openfn/language-http'],
      expression: 'fn()',
    },
  ]);
  const result = getAutoinstallTargets(plan);
  t.is(result.length, 2);
  t.deepEqual(result, ['@openfn/language-common', '@openfn/language-http']);
});

test('plan with duplicate adaptors', (t) => {
  const plan = getPlan([
    {
      adaptors: ['@openfn/language-common'],
      expression: 'fn()',
    },
    {
      adaptors: ['@openfn/language-common'],
      expression: 'fn()',
    },
  ]);
  const result = getAutoinstallTargets(plan);
  t.is(result.length, 1);
  t.deepEqual(result, ['@openfn/language-common']);
});

test('plan with multiple adaptors in one step with duplicates', (t) => {
  const plan = getPlan([
    {
      adaptors: [
        '@openfn/language-common',
        '@openfn/language-http',
        '@openfn/language-http',
      ],
      expression: 'fn()',
    },
  ]);
  const result = getAutoinstallTargets(plan);
  t.is(result.length, 2);
  t.deepEqual(result, ['@openfn/language-common', '@openfn/language-http']);
});

test('plan with one adaptor but different versions', (t) => {
  const plan = getPlan([
    {
      adaptors: ['@openfn/language-common@1.0.0'],
      expression: 'fn()',
    },
    {
      adaptors: ['@openfn/language-common@2.0.0'],
      expression: 'fn()',
    },
    {
      adaptors: ['@openfn/language-common@3.0.0'],
      expression: 'fn()',
    },
  ]);
  const result = getAutoinstallTargets(plan);
  t.is(result.length, 3);
  t.deepEqual(result, [
    '@openfn/language-common@1.0.0',
    '@openfn/language-common@2.0.0',
    '@openfn/language-common@3.0.0',
  ]);
});

test('do not return adaptors with a path', (t) => {
  const plan = getPlan([
    {
      expression: 'fn()',
      adaptors: ['common=a/b/c'],
    },
  ]);
  const result = getAutoinstallTargets(plan);
  t.truthy(result);
  t.is(result.length, 0);
});
