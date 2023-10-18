import test from 'ava';
import preloadCredentials from '../../src/api/preload-credentials';
import { CompiledExecutionPlan } from '@openfn/runtime';

// Not very good test coverage
test('handle a plan with no credentials', async (t) => {
  let timesCalled = 0;

  const loader = async (id: string) => {
    timesCalled++;
    return `loaded-${id}`;
  };

  const plan = {
    id: 'a',
    jobs: [
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
  } as unknown as CompiledExecutionPlan;

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
    id: 'a',
    jobs: [
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
  } as unknown as CompiledExecutionPlan;

  const result = await preloadCredentials(plan, loader);

  t.is(timesCalled, 3);
  t.is(plan.jobs[0].configuration, 'loaded-a');
  t.is(plan.jobs[1].configuration, 'loaded-b');
  t.is(plan.jobs[2].configuration, 'loaded-c');
});
