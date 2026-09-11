import test from 'ava';
import { cloneDeep } from 'lodash-es';

import { Project } from '../../src/Project';
import toAppSpec from '../../src/serialize/to-app-spec';

const v2ProjectData: any = {
  id: 'my-project',
  name: 'My Project',
  schema_version: '4.0',
  workflows: [
    {
      id: 'my-workflow',
      name: 'My Workflow',
      start: 'webhook',
      steps: [
        {
          id: 'webhook',
          type: 'webhook',
          enabled: true,
          next: { 'transform-data': {} },
        },
        {
          id: 'transform-data',
          name: 'Transform data',
          expression: 'fn(s => s)',
          adaptor: '@openfn/language-common@latest',
        },
      ],
    },
  ],
};

const removableWorkflowData: any = {
  id: 'my-project',
  workflows: [
    {
      id: 'wf',
      name: 'wf',
      openfn: { uuid: 'wf-uuid' },
      steps: [
        {
          id: 'trigger',
          type: 'webhook',
          openfn: { uuid: 'trigger-uuid' },
          next: {
            step: { openfn: { uuid: 'edge-uuid' } },
          },
        },
        {
          id: 'step',
          name: 'step',
          expression: '.',
          adaptor: 'common',
          openfn: { uuid: 'step-uuid' },
        },
      ],
    },
  ],
};

test('edges use source_trigger/target_job keys, not UUIDs', (t) => {
  const project = new Project(v2ProjectData, { formats: { project: 'json' } });
  const result = toAppSpec(project, { format: 'json' }) as any;

  const edge = Object.values(result.workflows['my-workflow'].edges)[0] as any;
  t.truthy(edge.source_trigger);
  t.truthy(edge.target_job);
  t.falsy(edge.source_trigger_id);
  t.falsy(edge.target_job_id);
  t.falsy(edge.id);
});

test('handle credentials', (t) => {
  const data = cloneDeep(v2ProjectData);
  data.credentials = [
    {
      name: 'x',
      owner: 'a@b.org,',
      uuid: '123',
    },
  ];
  data.workflows[0].steps[1].configuration = `a@b.org|x`;

  const project = new Project(data, { formats: { project: 'json' } });
  const result = toAppSpec(project, { format: 'json' }) as any;

  t.deepEqual(result.credentials, {
    'a@b.org,|x': { name: 'x', owner: 'a@b.org,' },
  });
  t.is(
    result.workflows['my-workflow'].jobs['transform-data'].credential,
    'a@b.org|x'
  );
});

test('source_trigger matches the trigger key', (t) => {
  const project = new Project(v2ProjectData, { formats: { project: 'json' } });
  const result = toAppSpec(project, { format: 'json' }) as any;

  const wf = result.workflows['my-workflow'];
  const edge = Object.values(wf.edges)[0] as any;
  t.truthy(wf.triggers[edge.source_trigger]);
});

test('target_job matches the job key', (t) => {
  const project = new Project(v2ProjectData, { formats: { project: 'json' } });
  const result = toAppSpec(project, { format: 'json' }) as any;

  const wf = result.workflows['my-workflow'];
  const edge = Object.values(wf.edges)[0] as any;
  t.truthy(wf.jobs[edge.target_job]);
});

test('triggers and jobs have no generated id', (t) => {
  const project = new Project(v2ProjectData, { formats: { project: 'json' } });
  const result = toAppSpec(project, { format: 'json' }) as any;

  const wf = result.workflows['my-workflow'];
  const trigger = Object.values(wf.triggers)[0] as any;
  const job = Object.values(wf.jobs)[0] as any;
  t.falsy(trigger.id);
  t.falsy(job.id);
});

test('ignores removed flags', (t) => {
  const data = cloneDeep(removableWorkflowData);
  const project = new Project(data);
  project.getWorkflow('wf')!.remove('step');

  const result = toAppSpec(project, { format: 'json' }) as any;

  // a spec has no notion of delete: true - the step is serialized normally
  t.truthy(result.workflows['wf'].jobs.step);
  t.falsy(result.workflows['wf'].jobs.step.delete);
});
