import test from 'ava';
import { ExecutionPlan, Job } from '@openfn/lexicon';

import preloadCredentials from '../../src/api/preload-credentials';

// Not very good test coverage
test('handle a plan with no credentials', async (t) => {
  let timesCalled = 0;

  const loader = async (id: string) => {
    timesCalled++;
    return `loaded-${id}`;
  };

  const plan = {
    id: t.title,
    workflow: {
      steps: [
        {
          expression: '.',
        },
        {
          expression: '.',
        },
        {
          expression: '.',
        },
      ],
    },
    options: {},
  } as ExecutionPlan;

  const planCopy = JSON.parse(JSON.stringify(plan));
  const result = await preloadCredentials(plan, loader);

  t.is(timesCalled, 0);
  t.deepEqual(planCopy, result);
});

test('handle a plan with credentials', async (t) => {
  let timesCalled = 0;

  const loader = async (id: string) => {
    timesCalled++;
    return `loaded-${id}`;
  };

  const plan = {
    id: t.title,
    workflow: {
      steps: [
        {
          expression: '.',
          configuration: 'a',
        },
        {
          expression: '.',
          configuration: 'b',
        },
        {
          expression: '.',
          configuration: 'c',
        },
      ],
    },
    options: {},
  } as ExecutionPlan;

  await preloadCredentials(plan, loader);

  t.is(timesCalled, 3);
  t.is((plan.workflow.steps[0] as Job).configuration, 'loaded-a');
  t.is((plan.workflow.steps[1] as Job).configuration, 'loaded-b');
  t.is((plan.workflow.steps[2] as Job).configuration, 'loaded-c');
});

test('throw if one credential fails to load', async (t) => {
  const loader = async () => {
    throw new Error('err');
  };

  const plan = {
    id: t.title,
    workflow: {
      steps: [
        {
          id: 'z',
          expression: '.',
          configuration: 'a',
        },
      ],
    },
    options: {},
  } as ExecutionPlan;

  try {
    await preloadCredentials(plan, loader);
  } catch (e: any) {
    t.is(e.name, 'CredentialLoadError');
    t.is(e.message, `Failed to load credential a: err`);
  }
});

test('throw if several credentials fail to load', async (t) => {
  const loader = async () => {
    throw new Error('err');
  };

  const plan = {
    id: t.title,
    workflow: {
      steps: [
        {
          id: 'j',
          expression: '.',
          configuration: 'a',
        },
        {
          id: 'k',
          expression: '.',
          configuration: 'b',
        },
      ],
    },
    options: {},
  } as ExecutionPlan;

  try {
    await preloadCredentials(plan, loader);
  } catch (e: any) {
    t.is(e.name, 'CredentialLoadError');
    t.is(
      e.message,
      `Failed to load credential a: err
Failed to load credential b: err`
    );
  }
});

test('only report each credential once', async (t) => {
  const loader = async () => {
    throw new Error('err');
  };

  const plan = {
    id: t.title,
    workflow: {
      steps: [
        {
          id: 'j',
          expression: '.',
          configuration: 'a',
        },
        {
          id: 'k',
          expression: '.',
          configuration: 'a',
        },
      ],
    },
    options: {},
  } as ExecutionPlan;

  try {
    await preloadCredentials(plan, loader);
  } catch (e: any) {
    t.is(e.name, 'CredentialLoadError');
    t.is(e.message, `Failed to load credential a: err`);
  }
});
