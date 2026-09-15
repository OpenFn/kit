import test from 'ava';

import { Project } from '../../src/Project';
import fromAppSpec, { isAppSpec } from '../../src/parse/from-app-spec';
import toAppSpec from '../../src/serialize/to-app-spec';

// A v1 spec, as the app exports it: no uuids, everything referenced by key.
// The three-job workflow matters - a single-job workflow parses fine even
// when edge matching is broken
const spec: any = {
  name: 'my-project',
  description: 'a test project',
  credentials: {
    'a@b.org-cred-one': { name: 'cred-one', owner: 'a@b.org' },
    'a@b.org-cred-two': { name: 'cred-two', owner: 'a@b.org' },
  },
  workflows: {
    'Event-based-workflow': {
      name: 'Event-based workflow',
      jobs: {
        'Transform-data': {
          name: 'Transform data',
          adaptor: '@openfn/language-common@latest',
          credential: 'a@b.org-cred-one',
          body: 'fn(s => s)',
        },
      },
      triggers: {
        webhook: { type: 'webhook', enabled: true },
      },
      edges: {
        'webhook->Transform-data': {
          source_trigger: 'webhook',
          target_job: 'Transform-data',
          condition_type: 'always',
          enabled: true,
        },
      },
    },
    'my-workflow': {
      name: 'my workflow',
      jobs: {
        A: { name: 'A', adaptor: 'common', credential: null, body: 'get()' },
        Common: { name: 'Common', adaptor: 'common', body: 'fn()' },
        'Send-gmail-email': {
          name: 'Send gmail email',
          adaptor: 'gmail',
          body: 'send()',
        },
      },
      triggers: {
        cron: { type: 'cron', cron_expression: '*/15 * * * *', enabled: false },
      },
      edges: {
        'cron->A': {
          source_trigger: 'cron',
          target_job: 'A',
          condition_type: 'always',
          enabled: true,
        },
        'A->Common': {
          source_job: 'A',
          target_job: 'Common',
          condition_type: 'on_job_success',
          enabled: true,
        },
        'Common->Send-gmail-email': {
          source_job: 'Common',
          target_job: 'Send-gmail-email',
          condition_type: 'on_job_success',
          enabled: false,
        },
      },
    },
  },
};

const getWorkflow = (result: any, id: string) =>
  result.workflows.find((wf: any) => wf.id === id);

const getStep = (workflow: any, id: string) =>
  workflow.steps.find((s: any) => s.id === id);

test('isAppSpec: true for a name-keyed spec', (t) => {
  t.true(isAppSpec(spec));
});

test('isAppSpec: false for v1 state', (t) => {
  t.false(
    isAppSpec({
      id: 'uuid',
      project_credentials: [],
      workflows: {
        wf: {
          id: 'wf-uuid',
          edges: {
            e: { id: 'edge-uuid', source_trigger_id: 'x', target_job_id: 'y' },
          },
        },
      },
    })
  );
});

test('isAppSpec: true for a spec with no credentials, via its edges', (t) => {
  t.true(
    isAppSpec({
      name: 'p',
      workflows: {
        wf: {
          name: 'wf',
          edges: { e: { source_trigger: 'webhook', target_job: 'a' } },
        },
      },
    })
  );
});

test('credentials become an array with no uuids', (t) => {
  const result: any = fromAppSpec(spec);

  t.deepEqual(result.credentials, [
    { name: 'cred-one', owner: 'a@b.org' },
    { name: 'cred-two', owner: 'a@b.org' },
  ]);
});

test('a job credential key becomes an owner|name configuration', (t) => {
  const result: any = fromAppSpec(spec);

  const wf = getWorkflow(result, 'event-based-workflow');
  const job = getStep(wf, 'transform-data');
  t.is(job.configuration, 'a@b.org|cred-one');
});

test('a job body becomes an expression', (t) => {
  const result: any = fromAppSpec(spec);

  const wf = getWorkflow(result, 'event-based-workflow');
  const job = getStep(wf, 'transform-data');
  t.is(job.expression, 'fn(s => s)');
  t.is(job.adaptor, '@openfn/language-common@latest');
  t.falsy(job.body);
});

test('a trigger becomes a step, and sets the workflow start', (t) => {
  const result: any = fromAppSpec(spec);

  const wf = getWorkflow(result, 'my-workflow');
  t.is(wf.start, 'cron');

  const trigger = getStep(wf, 'cron');
  t.is(trigger.type, 'cron');
  t.is(trigger.enabled, false);
  t.is(trigger.cron_expression, '*/15 * * * *');
});

test('edges hang off their source step, keyed by target', (t) => {
  const result: any = fromAppSpec(spec);

  const wf = getWorkflow(result, 'my-workflow');
  t.deepEqual(Object.keys(getStep(wf, 'cron').next), ['a']);
  t.deepEqual(Object.keys(getStep(wf, 'a').next), ['common']);
  t.deepEqual(Object.keys(getStep(wf, 'common').next), ['send-gmail-email']);

  // the last step in the chain has nothing downstream
  t.falsy(getStep(wf, 'send-gmail-email').next);
});

test('no step is ever wired to itself', (t) => {
  const result: any = fromAppSpec(spec);

  for (const wf of result.workflows) {
    for (const step of wf.steps) {
      for (const target of Object.keys(step.next ?? {})) {
        t.not(target, step.id);
      }
    }
  }
});

test('edge conditions and disabled flags are mapped', (t) => {
  const result: any = fromAppSpec(spec);

  const wf = getWorkflow(result, 'my-workflow');
  t.is(getStep(wf, 'cron').next.a.condition, 'always');

  const onSuccess = getStep(wf, 'a').next.common;
  t.is(onSuccess.condition, 'on_job_success');
  t.falsy(onSuccess.disabled);

  // enabled: false on the wire means disabled locally
  t.true(getStep(wf, 'common').next['send-gmail-email'].disabled);
});

test('a js_expression condition keeps its expression', (t) => {
  const result: any = fromAppSpec({
    name: 'p',
    workflows: {
      wf: {
        name: 'wf',
        jobs: { A: { name: 'A', body: 'fn()' }, B: { name: 'B', body: 'fn()' } },
        triggers: {},
        edges: {
          'A->B': {
            source_job: 'A',
            target_job: 'B',
            condition_type: 'js_expression',
            condition_expression: 'state.x > 1',
            enabled: true,
          },
        },
      },
    },
  });

  const wf = getWorkflow(result, 'wf');
  t.is(getStep(wf, 'a').next.b.condition, 'state.x > 1');
});

test('the result loads as a Project', (t) => {
  const project = new Project(fromAppSpec(spec));

  t.is(project.name, 'my-project');
  t.is(project.workflows.length, 2);
  // a spec has nothing stateful in it
  t.falsy(project.uuid);
});

test('round trips through to-app-spec', (t) => {
  const project = new Project(fromAppSpec(spec), {
    formats: { project: 'json' },
  });
  const roundTripped: any = fromAppSpec(
    toAppSpec(project, { format: 'json' }) as any
  );

  const wf = getWorkflow(roundTripped, 'my-workflow');
  t.is(wf.steps.length, 4);
  t.deepEqual(Object.keys(getStep(wf, 'a').next), ['common']);
  t.deepEqual(Object.keys(getStep(wf, 'common').next), ['send-gmail-email']);

  const eventWf = getWorkflow(roundTripped, 'event-based-workflow');
  t.is(getStep(eventWf, 'transform-data').configuration, 'a@b.org|cred-one');
});
