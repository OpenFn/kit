import { ExecutionPlan } from '@openfn/lexicon';
import test from 'ava';
import overridePlanAdaptors, {
  isJob,
} from '../../src/util/override-plan-adaptors';

// validates adaptors in a plan against an array.
function getAdaptors(plan: ExecutionPlan) {
  // check for a given id whether the
  const steps = plan.workflow.steps;

  const adaptors = steps.map((step) => {
    if (isJob(step)) return step.adaptors;
    return undefined;
  });
  return adaptors;
}

test('replace adaptors in plan using provided resolutions', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        {
          id: 'one',
          expression: 'fn(state=> state)',
          adaptors: ['@openfn/language-http@latest'],
        },
        {
          id: 'two',
          expression: 'fn(state=> state)',
          adaptors: ['@openfn/language-common@next'],
        },
        {
          expression: 'fn(state=> state)',
          adaptors: ['@openfn/language-common@2.1.0'],
        },
      ],
    },
  };

  const resolutions = {
    '@openfn/language-http@latest': '@openfn/language-http@2.9.0',
    '@openfn/language-common@next': '@openfn/language-common@2.2.0',
  };
  const finalPlan = overridePlanAdaptors(plan, resolutions);

  t.deepEqual(getAdaptors(finalPlan), [
    ['@openfn/language-http@2.9.0'],
    ['@openfn/language-common@2.2.0'],
    ['@openfn/language-common@2.1.0'],
  ]);
});

test("ignore override when there's nothing to override", (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        {
          id: 'one',
          expression: 'fn(state=> state)',
          adaptors: ['@openfn/language-http@latest'],
        },
        {
          id: 'two',
          expression: 'fn(state=> state)',
          adaptors: ['@openfn/language-common@next'],
        },
        {
          expression: 'fn(state=> state)',
          adaptors: ['@openfn/language-common@2.1.0'],
        },
      ],
    },
  };

  const resolutions = {
    '@openfn/language-http@2.9.0': '@openfn/language-http@2.9.0',
    '@openfn/language-common@2.2.0': '@openfn/language-common@2.2.0',
  };

  const finalPlan = overridePlanAdaptors(plan, resolutions);
  t.is(plan, finalPlan);
});

test('replace adaptors on only job steps', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        {
          id: 'x',
          next: 'two',
        },
        {
          id: 'two',
          expression: 'fn(state=> state)',
          adaptors: ['@openfn/language-common@next'],
        },
      ],
    },
  };
  const resolutions = {
    '@openfn/language-common@next': '@openfn/language-common@2.2.0',
  };

  const finalPlan = overridePlanAdaptors(plan, resolutions);
  t.deepEqual(getAdaptors(finalPlan), [
    undefined,
    ['@openfn/language-common@2.2.0'],
  ]);
});
