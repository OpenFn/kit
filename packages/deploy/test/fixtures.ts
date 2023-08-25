import { ProjectSpec } from '../src/types';

export function fullExampleSpec() {
  return {
    name: 'my project',
    description: 'some helpful description',
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
    description: 'some helpful description',
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
            condition: null,
            source_trigger_id: '71f0cbf1-4d8e-443e-afca-8a479ec281a1',
            source_job_id: null,
            target_job_id: '68e172b8-1cca-4085-aadf-8534761ef7c2',
          },
          'job-a->job-b': {
            id: '7132f768-e8e8-4167-8fc2-8d422244281f',
            condition: null,
            source_job_id: '68e172b8-1cca-4085-aadf-8534761ef7c2',
            source_trigger_id: null,
            target_job_id: 'e1bf76a8-4deb-44ff-9881-fbf676537b37',
          },
        },
      },
    },
  };
}

export const lightningProjectPayload = {
  id: 'ad186ffd-f7a9-4bbe-9a47-ef80779ad996',
  name: 'my-sample-project',
  description: null,
  inserted_at: '2023-08-25T08:57:31',
  updated_at: '2023-08-25T08:57:31',
  scheduled_deletion: null,
  requires_mfa: false,
  workflows: [
    {
      id: '05fab294-98dc-4d7d-85f3-024b2b0e6897',
      name: 'OpenHIE Workflow',
      inserted_at: '2023-08-25T08:57:31',
      project_id: 'ad186ffd-f7a9-4bbe-9a47-ef80779ad996',
      updated_at: '2023-08-25T08:57:31',
      deleted_at: null,
      edges: [
        {
          id: '7d8262a9-3bfa-4cdc-b562-c0a04c83c572',
          source_trigger_id: '951fb278-3829-40e6-b86d-c5a6603a0df1',
          target_job_id: '8852a349-0936-4141-8c12-d1bfd910e2dc',
          condition: 'always',
        },
        {
          id: 'a571d495-8f47-4c24-9be4-631eff6e3b8d',
          target_job_id: 'ed3f110a-c800-479b-9576-47bb87e9ad57',
          condition: 'on_job_success',
          source_job_id: '8852a349-0936-4141-8c12-d1bfd910e2dc',
        },
        {
          id: 'e4a2d2ff-1281-4549-b919-5a6fd369bdc3',
          target_job_id: 'f76a4faa-b648-4f44-b865-21154fa7ef7b',
          condition: 'on_job_success',
          source_job_id: 'ed3f110a-c800-479b-9576-47bb87e9ad57',
        },
        {
          id: 'f7163a97-03c5-4a45-9abf-69f1b771655f',
          target_job_id: 'd7ac4cfa-b900-4e14-80a3-94149589bbac',
          condition: 'on_job_failure',
          source_job_id: 'ed3f110a-c800-479b-9576-47bb87e9ad57',
        },
      ],
      jobs: [
        {
          enabled: true,
          id: '8852a349-0936-4141-8c12-d1bfd910e2dc',
          name: 'FHIR standard Data with change',
          body: 'fn(state => state);\n',
          adaptor: '@openfn/language-http@latest',
        },
        {
          enabled: true,
          id: 'ed3f110a-c800-479b-9576-47bb87e9ad57',
          name: 'Send to OpenHIM to route to SHR',
          body: 'fn(state => state);\n',
          adaptor: '@openfn/language-http@latest',
        },
        {
          enabled: true,
          id: 'f76a4faa-b648-4f44-b865-21154fa7ef7b',
          name: 'Notify CHW upload successful',
          body: 'fn(state => state);\n',
          adaptor: '@openfn/language-http@latest',
        },
        {
          enabled: true,
          id: 'd7ac4cfa-b900-4e14-80a3-94149589bbac',
          name: 'Notify CHW upload failed',
          body: 'fn(state => state);\n',
          adaptor: '@openfn/language-http@latest',
        },
      ],
      triggers: [
        {
          id: '951fb278-3829-40e6-b86d-c5a6603a0df1',
          type: 'webhook',
        },
      ],
    },
    {
      id: 'b7127395-54cc-47b4-9037-83fbd4965278',
      name: 'silent-shadow-9317',
      inserted_at: '2023-08-25T08:57:31',
      project_id: 'ad186ffd-f7a9-4bbe-9a47-ef80779ad996',
      updated_at: '2023-08-25T08:57:31',
      deleted_at: null,
      edges: [
        {
          id: '6e0d23fe-d3eb-418f-b5f8-32da9488baec',
          source_trigger_id: '388bbb05-9a88-4493-9ef1-7404274c27b8',
          target_job_id: '74306d89-2324-4292-9cd4-99450b750050',
          condition: 'always',
        },
      ],
      jobs: [
        {
          enabled: true,
          id: '74306d89-2324-4292-9cd4-99450b750050',
          name: 'New-job',
          body: "\nget('/myEndpoint', {\n   query: {foo: 'bar', a: 1},\n   headers: {'content-type': 'application/json'},\n   authentication: {username: 'user', password: 'pass'}\n })\n",
          adaptor: '@openfn/language-http@latest',
        },
      ],
      triggers: [
        {
          id: '388bbb05-9a88-4493-9ef1-7404274c27b8',
          type: 'webhook',
        },
      ],
    },
  ],
};

export const lightningProjectState = {
  id: 'ad186ffd-f7a9-4bbe-9a47-ef80779ad996',
  name: 'my-sample-project',
  description: null,
  inserted_at: '2023-08-25T08:57:31',
  updated_at: '2023-08-25T08:57:31',
  scheduled_deletion: null,
  requires_mfa: false,
  workflows: {
    'OpenHIE-Workflow': {
      id: '05fab294-98dc-4d7d-85f3-024b2b0e6897',
      name: 'OpenHIE Workflow',
      inserted_at: '2023-08-25T08:57:31',
      project_id: 'ad186ffd-f7a9-4bbe-9a47-ef80779ad996',
      updated_at: '2023-08-25T08:57:31',
      deleted_at: null,
      edges: {
        'webhook->FHIR-standard-Data-with-change': {
          id: '7d8262a9-3bfa-4cdc-b562-c0a04c83c572',
          source_trigger_id: '951fb278-3829-40e6-b86d-c5a6603a0df1',
          target_job_id: '8852a349-0936-4141-8c12-d1bfd910e2dc',
          condition: 'always',
        },
        'FHIR-standard-Data-with-change->Send-to-OpenHIM-to-route-to-SHR': {
          id: 'a571d495-8f47-4c24-9be4-631eff6e3b8d',
          target_job_id: 'ed3f110a-c800-479b-9576-47bb87e9ad57',
          condition: 'on_job_success',
          source_job_id: '8852a349-0936-4141-8c12-d1bfd910e2dc',
        },
        'Send-to-OpenHIM-to-route-to-SHR->Notify-CHW-upload-successful': {
          id: 'e4a2d2ff-1281-4549-b919-5a6fd369bdc3',
          target_job_id: 'f76a4faa-b648-4f44-b865-21154fa7ef7b',
          condition: 'on_job_success',
          source_job_id: 'ed3f110a-c800-479b-9576-47bb87e9ad57',
        },
        'Send-to-OpenHIM-to-route-to-SHR->Notify-CHW-upload-failed': {
          id: 'f7163a97-03c5-4a45-9abf-69f1b771655f',
          target_job_id: 'd7ac4cfa-b900-4e14-80a3-94149589bbac',
          condition: 'on_job_failure',
          source_job_id: 'ed3f110a-c800-479b-9576-47bb87e9ad57',
        },
      },
      jobs: {
        'FHIR-standard-Data-with-change': {
          enabled: true,
          id: '8852a349-0936-4141-8c12-d1bfd910e2dc',
          name: 'FHIR standard Data with change',
          body: 'fn(state => state);\n',
          adaptor: '@openfn/language-http@latest',
        },
        'Send-to-OpenHIM-to-route-to-SHR': {
          enabled: true,
          id: 'ed3f110a-c800-479b-9576-47bb87e9ad57',
          name: 'Send to OpenHIM to route to SHR',
          body: 'fn(state => state);\n',
          adaptor: '@openfn/language-http@latest',
        },
        'Notify-CHW-upload-successful': {
          enabled: true,
          id: 'f76a4faa-b648-4f44-b865-21154fa7ef7b',
          name: 'Notify CHW upload successful',
          body: 'fn(state => state);\n',
          adaptor: '@openfn/language-http@latest',
        },
        'Notify-CHW-upload-failed': {
          enabled: true,
          id: 'd7ac4cfa-b900-4e14-80a3-94149589bbac',
          name: 'Notify CHW upload failed',
          body: 'fn(state => state);\n',
          adaptor: '@openfn/language-http@latest',
        },
      },
      triggers: {
        webhook: {
          id: '951fb278-3829-40e6-b86d-c5a6603a0df1',
          type: 'webhook',
        },
      },
    },
    'silent-shadow-9317': {
      id: 'b7127395-54cc-47b4-9037-83fbd4965278',
      name: 'silent-shadow-9317',
      inserted_at: '2023-08-25T08:57:31',
      project_id: 'ad186ffd-f7a9-4bbe-9a47-ef80779ad996',
      updated_at: '2023-08-25T08:57:31',
      deleted_at: null,
      edges: {
        'webhook->New-job': {
          id: '6e0d23fe-d3eb-418f-b5f8-32da9488baec',
          source_trigger_id: '388bbb05-9a88-4493-9ef1-7404274c27b8',
          target_job_id: '74306d89-2324-4292-9cd4-99450b750050',
          condition: 'always',
        },
      },
      jobs: {
        'New-job': {
          enabled: true,
          id: '74306d89-2324-4292-9cd4-99450b750050',
          name: 'New-job',
          body: "\nget('/myEndpoint', {\n   query: {foo: 'bar', a: 1},\n   headers: {'content-type': 'application/json'},\n   authentication: {username: 'user', password: 'pass'}\n })\n",
          adaptor: '@openfn/language-http@latest',
        },
      },
      triggers: {
        webhook: {
          id: '388bbb05-9a88-4493-9ef1-7404274c27b8',
          type: 'webhook',
        },
      },
    },
  },
};
