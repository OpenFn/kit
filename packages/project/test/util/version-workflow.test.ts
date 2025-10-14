import test from 'ava';
import { Project } from '../../src/Project';
import { createWorkflow } from '../util';
import { workflow } from '../../src/util/version';

test('generate an 12 character version hash for a basic workflow', (t) => {
  // Keep workflows in lightning state format so that tests are easier to port
  const project = {
    id: 'p',
    workflows: [
      {
        id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
        name: 'a',
        edges: [
          {
            enabled: true,
            id: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
            source_trigger_id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
            condition_type: 'always',
            target_job_id: '66add020-e6eb-4eec-836b-20008afca816',
          },
        ],
        concurrency: null,
        inserted_at: '2025-04-23T11:19:32Z',
        updated_at: '2025-04-23T11:19:32Z',
        jobs: [
          {
            id: '66add020-e6eb-4eec-836b-20008afca816',
            name: 'Transform data',
            body: '// Check out the Job Writing Guide for help getting started:\n// https://docs.openfn.org/documentation/jobs/job-writing-guide\n',
            adaptor: '@openfn/language-common@latest',
            project_credential_id: null,
          },
        ],
        triggers: [
          {
            enabled: true,
            id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
            type: 'webhook',
          },
        ],
        lock_version: 1,
        deleted_at: null,
      },
    ],
  };

  const wf = Project.from('state', project).getWorkflow('a');

  const hash = workflow(wf);
  t.log(hash);
  t.is(hash, 'cli:fd18866bcb34');
});

/**
 *
 * different name/adaptor/credential/expression should generate different hash
 * Other keys should be ignored
 *
 * key order doesn't matter (arbitrary order, sort, inverse sort)
 *
 * include a prefix
 */
