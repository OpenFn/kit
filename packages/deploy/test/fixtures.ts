import { ProjectSpec } from "../src/types";

export function fullExampleSpec() {
  return {
    name: 'my project',
    workflows: {
      'workflow-one': {
        name: 'workflow one',
        jobs: {
          'job-a': {
            name: 'job a',
            adaptor: '@openfn/language-common@latest',
            body: '',
          },
          'job-b': {
            name: 'job b',
            adaptor: '@openfn/language-common@latest',
            body: '',
          },
        },
        triggers: {
          'trigger-one': {
            type: 'cron',
            cron_expression: '0 0 1 1 *',
          },
        },
        edges: {
          'trigger-one->job-a': {
            source_trigger: 'trigger-one',
            target_job: 'job-a',
          },
          'job-a->job-b': {
            source_job: 'job-a',
            target_job: 'job-b',
          },
        },
      },
    },
  } as ProjectSpec;
}

export function fullExampleState() {
  return {
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
            adaptor: '@openfn/language-common@latest',
            body: '',
            enabled: true,
          },
          'job-b': {
            id: 'e1bf76a8-4deb-44ff-9881-fbf676537b37',
            name: 'job b',
            adaptor: '@openfn/language-common@latest',
            body: '',
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
        edges: {
          'trigger-one->job-a': {
            id: 'ea264d6d-9767-4a2c-810f-deb10961a6dc',
            source_trigger_id: '71f0cbf1-4d8e-443e-afca-8a479ec281a1',
            target_job_id: '68e172b8-1cca-4085-aadf-8534761ef7c2',
          },
          'job-a->job-b': {
            id: '7132f768-e8e8-4167-8fc2-8d422244281f',
            source_job_id: '68e172b8-1cca-4085-aadf-8534761ef7c2',
            target_job_id: 'e1bf76a8-4deb-44ff-9881-fbf676537b37',
          },
        },
      },
    },
  };
}
