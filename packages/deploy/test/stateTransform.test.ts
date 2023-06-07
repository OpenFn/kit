import test from 'ava';
import jp from 'jsonpath';
import {
  mergeProjectPayloadIntoState,
  mergeSpecIntoState,
} from '../src/stateTransform';
import { ProjectPayload } from '../src/types';
import { fullExampleSpec, fullExampleState } from './fixtures';

test('toNextState adding a job', (t) => {
  const spec = {
    name: 'project-name',
    workflows: {
      'workflow-one': {
        name: 'workflow one',
        jobs: {
          'new-job': {
            name: 'new job',
            adaptor: '@openfn/language-adaptor',
            body: 'foo()',
          },
        },
        triggers: {
          'trigger-one': {
            type: 'cron',
            cron_expression: '0 0 1 1 *',
          },
        },
        edges: {},
      },
    },
  };

  const state = {
    workflows: {
      'workflow-one': {
        name: 'workflow one',
        jobs: {},
        triggers: {
          'trigger-one': {
            id: '57912d4a-13e5-4857-8e1b-473be3816fd8',
          },
        },
        edges: {},
        id: 'f6f61f17-060f-4549-b549-4e8e1b5c026a',
      },
    },
    id: 'ecb683d1-5e5a-4c4f-9165-e143e2eeeb48',
    name: 'project-name',
  };

  let result = mergeSpecIntoState(state, spec);

  t.deepEqual(result, {
    workflows: {
      'workflow-one': {
        name: 'workflow one',
        jobs: {
          'new-job': {
            id: getItem(result, 'jobs', 'new-job').id,
            name: 'new job',
            adaptor: '@openfn/language-adaptor',
            body: 'foo()',
            enabled: true,
          },
        },
        triggers: {
          'trigger-one': {
            id: '57912d4a-13e5-4857-8e1b-473be3816fd8',
            type: 'cron',
            cron_expression: '0 0 1 1 *',
          },
        },
        edges: {},
        id: 'f6f61f17-060f-4549-b549-4e8e1b5c026a',
      },
    },
    id: 'ecb683d1-5e5a-4c4f-9165-e143e2eeeb48',
    name: 'project-name',
  });
});

function getItem(result: {}, itemType: string, key: string) {
  const items = jp.query(result, `$..workflows[*].${itemType}["${key}"]`);

  if (items.length === 0) {
    throw new Error(`No ${itemType} found for key: ${key}`);
  }

  if (items.length > 1) {
    throw new Error(`Multiple items found for key: ${key}`);
  }

  return items[0];
}

test('toNextState with empty state', (t) => {
  const state = { workflows: {} };
  const spec = fullExampleSpec();
  let result = mergeSpecIntoState(state, spec);

  const expected = {
    id: result.id,
    name: 'my project',
    workflows: {
      'workflow-one': {
        id: jp.query(result, '$..workflows["workflow-one"].id')[0],
        name: 'workflow one',
        jobs: {
          'job-a': {
            id: getItem(result, 'jobs', 'job-a').id,
            adaptor: '@openfn/language-common@latest',
            name: 'job a',
            body: '',
            enabled: true,
          },
          'job-b': {
            id: getItem(result, 'jobs', 'job-b').id,
            adaptor: '@openfn/language-common@latest',
            name: 'job b',
            body: '',
            enabled: true,
          },
        },
        triggers: {
          'trigger-one': {
            id: getItem(result, 'triggers', 'trigger-one').id,
            type: 'cron',
          },
        },
        edges: {
          'trigger-one->job-a': {
            id: getItem(result, 'edges', 'trigger-one->job-a').id,
            source_trigger_id: getItem(result, 'triggers', 'trigger-one').id,
            target_job_id: getItem(result, 'jobs', 'job-a').id,
          },
          'job-a->job-b': {
            id: getItem(result, 'edges', 'job-a->job-b').id,
            source_job_id: getItem(result, 'jobs', 'job-a').id,
            target_job_id: getItem(result, 'jobs', 'job-b').id,
          },
        },
      },
    },
  };

  t.deepEqual(result, expected);
});

test('toNextState with no changes', (t) => {
  const state = {
    id: 'be156ab1-8426-4151-9a18-4045142f9ec0',
    name: 'my project',
    workflows: {
      'workflow-one': {
        id: '8124e88c-566f-472f-be38-363e588af55a',
        name: 'workflow one',
        jobs: {
          'new-job': {
            id: '68e172b8-1cca-4085-aadf-8534761ef7c2',
            name: 'new job',
            adaptor: '@openfn/language-adaptor',
            body: 'foo()',
            enabled: true,
          },
        },
        triggers: {
          'trigger-one': {
            id: '71f0cbf1-4d8e-443e-afca-8a479ec281a1',
            type: 'cron',
            cron_expression: '0 0 1 1 *',
          },
        },
        edges: {},
      },
    },
  };

  const spec = {
    name: 'my project',
    workflows: {
      'workflow-one': {
        name: 'workflow one',
        jobs: {
          'new-job': {
            name: 'new job',
            adaptor: '@openfn/language-adaptor',
            body: 'foo()',
          },
        },
        triggers: {
          'trigger-one': {
            type: 'cron',
            cron_expression: '0 0 1 1 *',
          },
        },
        edges: {},
      },
    },
  };

  let result = mergeSpecIntoState(state, spec);

  t.deepEqual(result, state);
});

test('toNextState with a new job', (t) => {
  const state = {
    id: 'be156ab1-8426-4151-9a18-4045142f9ec0',
    name: 'my project',
    workflows: {
      'workflow-one': {
        id: '8124e88c-566f-472f-be38-363e588af55a',
        name: 'workflow one',
        jobs: {
          'job-a': {
            id: '68e172b8-1cca-4085-aadf-8534761ef7c2',
            name: 'job a',
          },
        },
        triggers: {
          'trigger-one': {
            id: '71f0cbf1-4d8e-443e-afca-8a479ec281a1',
            type: 'webhook',
          },
        },
        edges: {},
      },
    },
  };

  const spec = {
    name: 'my project',
    workflows: {
      'workflow-one': {
        name: 'workflow one',
        jobs: {
          'job-a': {
            name: 'job a',
            enabled: false,
            body: 'foo()',
            adaptor: '@openfn/language-adaptor',
          },
          'job-b': {
            name: 'job b',
          },
        },
        triggers: {
          'trigger-one': {
            type: 'webhook',
          },
        },
        edges: {},
      },
    },
  };
  let result = mergeSpecIntoState(state, spec);

  t.deepEqual(result, {
    id: 'be156ab1-8426-4151-9a18-4045142f9ec0',
    name: 'my project',
    workflows: {
      'workflow-one': {
        id: '8124e88c-566f-472f-be38-363e588af55a',
        name: 'workflow one',
        jobs: {
          'job-a': {
            id: '68e172b8-1cca-4085-aadf-8534761ef7c2',
            name: 'job a',
            enabled: false,
            body: 'foo()',
            adaptor: '@openfn/language-adaptor',
          },
          'job-b': {
            id: getItem(result, 'jobs', 'job-b').id,
            name: 'job b',
            adaptor: undefined,
            enabled: true,
            body: undefined,
          },
        },
        triggers: {
          'trigger-one': {
            id: '71f0cbf1-4d8e-443e-afca-8a479ec281a1',
            type: 'webhook',
          },
        },
        edges: {},
      },
    },
  });
});

test('toNextState removing a job and edge', (t) => {
  let existingState = fullExampleState();
  let spec = fullExampleSpec();

  delete spec.workflows['workflow-one'].jobs['job-b'];
  delete spec.workflows['workflow-one'].edges['job-a->job-b'];

  let result = mergeSpecIntoState(existingState, spec);

  jp.apply(
    existingState,
    '$.workflows["workflow-one"].jobs["job-b"]',
    (value) => {
      return { id: value.id, delete: true };
    }
  );

  jp.apply(
    existingState,
    '$.workflows["workflow-one"].edges["job-a->job-b"]',
    (value) => {
      return { id: value.id, delete: true };
    }
  );

  t.deepEqual(result, existingState);
});

test('mergeProjectIntoState with no changes', (t) => {
  let existingState = fullExampleState();
  const workflowOne = existingState.workflows['workflow-one'];
  let projectPayload: ProjectPayload = {
    id: existingState.id,
    name: 'my project',
    workflows: [
      {
        id: workflowOne.id,
        name: workflowOne.name,
        jobs: [
          getItem(existingState, 'jobs', 'job-a'),
          getItem(existingState, 'jobs', 'job-b'),
        ],
        triggers: [getItem(existingState, 'triggers', 'trigger-one')],
        edges: [
          getItem(existingState, 'edges', 'trigger-one->job-a'),
          getItem(existingState, 'edges', 'job-a->job-b'),
        ],
      },
    ],
  };

  let result = mergeProjectPayloadIntoState(existingState, projectPayload);

  t.deepEqual(result, existingState);
});

test('mergeProjectIntoState with deletions', (t) => {
  let existingState = fullExampleState();

  jp.apply(existingState, '$.workflows["workflow-one"].jobs', (value) => {
    return Object.fromEntries(
      Object.entries(value).filter(([key, _value]) => key !== 'job-b')
    );
  });

  jp.apply(existingState, '$.workflows["workflow-one"].edges', (value) => {
    return Object.fromEntries(
      Object.entries(value).filter(([key, _value]) => key !== 'job-a->job-b')
    );
  });

  const workflowOne = existingState.workflows['workflow-one'];
  let projectPayload: ProjectPayload = {
    id: existingState.id,
    name: 'my project',
    workflows: [
      {
        id: workflowOne.id,
        name: workflowOne.name,
        jobs: [getItem(existingState, 'jobs', 'job-a')],
        triggers: [getItem(existingState, 'triggers', 'trigger-one')],
        edges: [getItem(existingState, 'edges', 'trigger-one->job-a')],
      },
    ],
  };

  let result = mergeProjectPayloadIntoState(existingState, projectPayload);

  t.deepEqual(result, existingState);
});
