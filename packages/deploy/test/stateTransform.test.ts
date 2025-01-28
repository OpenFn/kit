import test from 'ava';
import jp from 'jsonpath';
import {
  getStateFromProjectPayload,
  mergeProjectPayloadIntoState,
  mergeSpecIntoState,
} from '../src/stateTransform';
import { ProjectPayload } from '../src/types';
import {
  fullExampleSpec,
  fullExampleState,
  lightningProjectPayload,
  lightningProjectState,
} from './fixtures';

test('toNextState adding a job', (t) => {
  const spec = {
    name: 'project-name',
    description: 'my test project',
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
            enabled: false,
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
            enabled: true,
          },
        },
        edges: {},
        id: 'f6f61f17-060f-4549-b549-4e8e1b5c026a',
      },
    },
    id: 'ecb683d1-5e5a-4c4f-9165-e143e2eeeb48',
    name: 'project-name',
    description: 'my test project',
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
            project_credential_id: undefined,
          },
        },
        triggers: {
          'trigger-one': {
            id: '57912d4a-13e5-4857-8e1b-473be3816fd8',
            type: 'cron',
            cron_expression: '0 0 1 1 *',
            enabled: false,
          },
        },
        edges: {},
        id: 'f6f61f17-060f-4549-b549-4e8e1b5c026a',
      },
    },
    id: 'ecb683d1-5e5a-4c4f-9165-e143e2eeeb48',
    name: 'project-name',
    description: 'my test project',
    project_credentials: {},
    collections: {},
  });
});

test('toNextState deleting a credential', (t) => {
  const spec = {
    name: 'project-name',
    description: 'my test project',
    collections: {},
    workflows: {},
  };

  const state = {
    workflows: {},
    project_credentials: {},
    collections: {
      'test-collection': {
        id: 'f8e1c1e1-5c5a-4d9b-8e9f-4b2f6b1c2f4e',
        name: 'test-collection',
      },
    },
    id: 'ecb683d1-5e5a-4c4f-9165-e143e2eeeb48',
    name: 'project-name',
    description: 'my test project',
  };

  let result = mergeSpecIntoState(state, spec);

  t.deepEqual(result, {
    workflows: {},
    id: 'ecb683d1-5e5a-4c4f-9165-e143e2eeeb48',
    name: 'project-name',
    description: 'my test project',
    project_credentials: {},
    collections: {
      'test-collection': {
        id: 'f8e1c1e1-5c5a-4d9b-8e9f-4b2f6b1c2f4e',
        delete: true,
      },
    },
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
    description: 'some helpful description',
    project_credentials: {},
    collections: {},
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
            project_credential_id: null,
          },
          'job-b': {
            id: getItem(result, 'jobs', 'job-b').id,
            adaptor: '@openfn/language-common@latest',
            name: 'job b',
            body: '',
            project_credential_id: null,
          },
        },
        triggers: {
          'trigger-one': {
            id: getItem(result, 'triggers', 'trigger-one').id,
            type: 'cron',
            cron_expression: '0 0 1 1 *',
            enabled: true,
          },
        },
        edges: {
          'trigger-one->job-a': {
            id: getItem(result, 'edges', 'trigger-one->job-a').id,
            condition_type: 'always',
            source_trigger_id: getItem(result, 'triggers', 'trigger-one').id,
            target_job_id: getItem(result, 'jobs', 'job-a').id,
            enabled: true,
          },
          'job-a->job-b': {
            id: getItem(result, 'edges', 'job-a->job-b').id,
            condition_type: 'js_expression',
            condition_expression: 'state.data > 18',
            condition_label: 'not-minor',
            source_job_id: getItem(result, 'jobs', 'job-a').id,
            target_job_id: getItem(result, 'jobs', 'job-b').id,
            enabled: true,
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
    description: 'for the humans',
    project_credentials: {},
    collections: {},
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
            project_credential_id: undefined,
          },
        },
        triggers: {
          'trigger-one': {
            id: '71f0cbf1-4d8e-443e-afca-8a479ec281a1',
            type: 'cron',
            cron_expression: '0 0 1 1 *',
            enabled: true,
          },
        },
        edges: {},
      },
    },
  };

  const spec = {
    name: 'my project',
    description: 'for the humans',
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
            enabled: true,
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
    description: 'for the humans',
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
    description: 'some other description',
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
    description: 'some other description',
    project_credentials: {},
    collections: {},
    workflows: {
      'workflow-one': {
        id: '8124e88c-566f-472f-be38-363e588af55a',
        name: 'workflow one',
        jobs: {
          'job-a': {
            id: '68e172b8-1cca-4085-aadf-8534761ef7c2',
            name: 'job a',
            body: 'foo()',
            adaptor: '@openfn/language-adaptor',
            project_credential_id: undefined,
          },
          'job-b': {
            id: getItem(result, 'jobs', 'job-b').id,
            name: 'job b',
            adaptor: undefined,
            body: undefined,
            project_credential_id: undefined,
          },
        },
        triggers: {
          'trigger-one': {
            id: '71f0cbf1-4d8e-443e-afca-8a479ec281a1',
            type: 'webhook',
            enabled: true,
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

test('toNextState with for kafka trigger', (t) => {
  const state = { workflows: {} };
  const spec = {
    name: 'my project',
    description: 'for the humans',
    workflows: {
      dummyWorkflow: {
        name: 'workflow one',
        jobs: {
          'new-job': {
            name: 'new job',
            adaptor: '@openfn/language-adaptor',
            body: 'foo()',
          },
        },
        triggers: {
          kafka: {
            type: 'kafka',
            enabled: true,
            kafka_configuration: {
              hosts: ['localhost:9092'],
              topics: ['test'],
              connect_timeout: 30,
              initial_offset_reset_policy: 'earliest',
            },
          },
        },
        edges: {},
      },
    },
  };

  let result = mergeSpecIntoState(state, spec);

  let expectedHosts = [['localhost', '9092']];

  t.deepEqual(
    result.workflows.dummyWorkflow.triggers.kafka.kafka_configuration.hosts,
    expectedHosts
  );

  // deploy error is raised when host is incorrect
  const badHosts = ['localhost', 'http://localhost:9092'];
  badHosts.forEach((badHost) => {
    const badSpec = {
      name: 'my project',
      description: 'for the humans',
      workflows: {
        dummyWorkflow: {
          name: 'workflow one',
          jobs: {},
          edges: {},
          triggers: {
            kafka: {
              type: 'kafka',
              enabled: true,
              kafka_configuration: {
                hosts: [badHost],
                topics: ['test'],
                connect_timeout: 30,
                initial_offset_reset_policy: 'earliest',
              },
            },
          },
        },
      },
    };

    t.throws(
      () => {
        mergeSpecIntoState({ workflows: {} }, badSpec);
      },
      {
        message: `Kafka host must be specified in the format host:port, found: ${badHost}`,
      }
    );
  });
});

test('mergeProjectIntoState with no changes', (t) => {
  let existingState = fullExampleState();
  const workflowOne = existingState.workflows['workflow-one'];
  let projectPayload: ProjectPayload = {
    id: existingState.id,
    name: 'my project',
    description: 'some helpful description',
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
    description: 'some helpful description',
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

test('getStateFromProjectPayload with minimal project', (t) => {
  // project payload from lightning sever
  const project = {
    id: 'xyz',
    name: 'project',
    workflows: [
      {
        id: 'wf-a',
        name: 'a',
        project_id: 'xyz',
        triggers: [
          {
            id: 't1',
            type: 'webhook',
          },
        ],
        jobs: [
          {
            id: 'job-1',
            name: 'My job',
            body: 'fn(state => state);',
            adaptor: '@openfn/language-common@latest',
          },
        ],
        edges: [
          {
            id: 't1-job-1',
            target_job_id: 'job-1',
            condition_type: 'on_job_failure',
            source_trigger_id: 't1',
            enabled: true,
          },
        ],
      },
    ],
  };

  const state = getStateFromProjectPayload(project);
  t.deepEqual(state, {
    id: 'xyz',
    name: 'project',
    project_credentials: {},
    collections: {},
    workflows: {
      a: {
        id: 'wf-a',
        name: 'a',
        project_id: 'xyz',
        triggers: {
          webhook: {
            id: 't1',
            type: 'webhook',
          },
        },
        jobs: {
          'My-job': {
            id: 'job-1',
            name: 'My job',
            body: 'fn(state => state);',
            adaptor: '@openfn/language-common@latest',
          },
        },
        edges: {
          'webhook->My-job': {
            id: 't1-job-1',
            target_job_id: 'job-1',
            condition_type: 'on_job_failure',
            source_trigger_id: 't1',
            enabled: true,
          },
        },
      },
    },
  });
});

test('getStateFromProjectPayload with full lightning project', (t) => {
  const project = lightningProjectPayload;
  const expectedState = lightningProjectState;

  const state = getStateFromProjectPayload(project);

  t.deepEqual(state, expectedState);
});
