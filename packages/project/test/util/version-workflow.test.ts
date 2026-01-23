import test from 'ava';
import { generateHash, parse } from '../../src/util/version';
import Project, { generateWorkflow } from '../../src';

// this is an actual lightning workflow state, copied verbatim
// todo already out of data as the version will change soon
// next, update this
const example = {
  id: '320157d2-260d-4e32-91c0-db935547c263',
  name: 'Turtle Power',
  edges: [
    {
      enabled: true,
      id: 'ed3ebfbf-6fa3-4438-b21d-06f7eec216c1',
      condition_type: 'always',
      source_trigger_id: 'bf10f31a-cf51-45a2-95a4-756d0a25af53',
      target_job_id: '4d18c46b-3bb4-4af1-81e2-07f9aee527fc',
    },
    {
      enabled: true,
      id: '253bf2d7-1a01-44c8-8e2e-ccf50de92dff',
      condition_type: 'js_expression',
      condition_label: 'always tbh',
      condition_expression: 'state.data',
      source_job_id: '4d18c46b-3bb4-4af1-81e2-07f9aee527fc',
      target_job_id: '40b839bd-5ade-414e-8dde-ed3ae77239ea',
    },
  ],
  version_history: ['app:91105e0d0600'],
  inserted_at: '2025-12-19T15:26:49Z',
  jobs: [
    {
      id: '4d18c46b-3bb4-4af1-81e2-07f9aee527fc',
      name: 'Transform data',
      body: 'fri1',
      adaptor: '@openfn/language-http@7.2.6',
      project_credential_id: 'dd409089-5569-4157-8cf6-528ace283348',
    },
    {
      id: '40b839bd-5ade-414e-8dde-ed3ae77239ea',
      name: 'do something',
      body: '// Check out the Job Writing Guide for help getting started:\n// https://docs.openfn.org/documentation/jobs/job-writing-guide\n',
      adaptor: '@openfn/language-http@7.2.6',
      project_credential_id: null,
    },
  ],
  triggers: [
    {
      enabled: false,
      id: 'bf10f31a-cf51-45a2-95a4-756d0a25af53',
      type: 'webhook',
    },
  ],
  updated_at: '2026-01-23T12:08:47Z',
  lock_version: 34,
  deleted_at: null,
  concurrency: null,
};

// TODO I need more control over ordering
// so I want to generate a bunch of decoded strings which test the order

test.skip('match lightning version', async (t) => {
  const [expected] = example.version_history;

  // load the project from v1 state
  const proj = await Project.from('state', {
    workflows: [example],
  });

  /**
   * why difference?
   *
   * the order of stuff is quite different
   * the app version seems to have the node name 3 times?
   *
   * step/node order is different
   *
   * ok, cli doesnt include structure, the edge targets
   */

  const wf = proj.workflows[0];
  const hash = wf.getVersionHash();
  t.log(expected);
  t.log(hash);
  t.is(parse(hash).hash, parse(expected).hash);
});

test('generate an 12 character version hash for a basic workflow', (t) => {
  const workflow = generateWorkflow(
    `
    @name a
    @id some-id
    webhook-transform_data(name="Transform data",expression="fn(s => s)")
    `
  );
  const hash = workflow.getVersionHash();
  t.is(hash, 'cli:72aed7c5f224');
});

test('unique hash but different steps order', (t) => {
  const workflow1 = generateWorkflow(
    `
    @name same-workflow
    @id id-one
    a-b
    a-c
    a-d
    `
  );

  // different order of nodes but should generate the same hash
  const workflow2 = generateWorkflow(
    `
    @name same-workflow
    @id id-two
    a-d
    a-c
    a-b
    `
  );

  // validate second step is actually different
  t.is(workflow1.steps[1].name, 'b');
  t.is(workflow2.steps[1].name, 'd');

  // assert that hashes are the same
  t.is(generateHash(workflow1), generateHash(workflow2));
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

test('hash changes when workflow name changes', (t) => {
  const wf1 = generateWorkflow(
    `
    @name wf-1
    @id workflow-id 
    a-b
    b-c
    `
  );
  const wf2 = generateWorkflow(
    `
    @name wf-2
    @id workflow-id 
    a-b
    b-c
    `
  );
  t.not(generateHash(wf1), generateHash(wf2));
});

test('hash a trigger', (t) => {
  // check that various  changes on a trigger update the hash
  const webhook = generateWorkflow(
    `@name wf-1
    @id workflow-id 
    t(type=webhook)-x(expression=x)
    `
  );
  const cron = generateWorkflow(
    `@name wf-1
    @id workflow-id 
    t(type=cron)-x(expression=x)
    `
  );

  t.not(generateHash(webhook), generateHash(cron));

  const cronEnabled = generateWorkflow(
    `@name wf-1
    @id workflow-id
    t(enabled=false)-x
    `
  );
  t.not(generateHash(webhook), generateHash(cronEnabled));

  const cronExpression = generateWorkflow(
    `@name wf-1
    @id workflow-id
    t(cron_expression="1")-x
    `
  );
  t.not(generateHash(webhook), generateHash(cronExpression));
});

test('hash changes across an edge', (t) => {
  const basicEdge = generateWorkflow(
    `
    @name wf-1
    @id workflow-id 
    a-b
    `
  );

  const withLabel = generateWorkflow(
    `
    @name wf-1
    @id workflow-id 
    a-(label=x)-b
    `
  );

  t.not(generateHash(basicEdge), generateHash(withLabel));

  const withCondition = generateWorkflow(
    `
    @name wf-1
    @id workflow-id 
    a-(condition=always)-b
    `
  );

  t.not(generateHash(basicEdge), generateHash(withCondition));

  const withDisabled = generateWorkflow(
    `
    @name wf-1
    @id workflow-id 
    a-(disabled=true)-b
    `
  );

  t.not(generateHash(basicEdge), generateHash(withDisabled));
});

// TODO joe to think more about credential mapping (keychain and project cred keys)
// can't get credentials to work in the generator, need to fix that
test.skip('hash changes when credentials field changes', (t) => {
  const wf1 = generateWorkflow(
    `
    @name wf-1
    @credentials cred-1
    @id workflow-id 
    a-b
    b-c
    `
  );
  const wf2 = generateWorkflow(
    `
    @name wf-1
    @credentials cred-2
    @id workflow-id 
    a-b
    b-c
    `
  );
  t.not(generateHash(wf1), generateHash(wf2));
});

test("hash changes when a step's adaptor changes", (t) => {
  const wf1 = generateWorkflow(
    `
    @name wf-1 
    @id workflow-id 
    a-b(adaptor=http)
    b-c
    `
  );
  const wf2 = generateWorkflow(
    `
    @name wf-1
    @id workflow-id 
    a-b(adaptor=common)
    b-c
    `
  );
  t.not(generateHash(wf1), generateHash(wf2));
});

test("hash changes when a step's expression changes", (t) => {
  const wf1 = generateWorkflow(
    `
    @name wf-1 
    @id workflow-id 
    a-b
    b-c(expression="x=1")
    `
  );
  const wf2 = generateWorkflow(
    `
    @name wf-1
    @id workflow-id 
    a-b
    b-c(expression="x=2")
    `
  );
  t.not(generateHash(wf1), generateHash(wf2));
});

test('ignored fields do not affect hash', (t) => {
  const wf1 = generateWorkflow(
    `
    @name wf-1 
    @id workflow-id 
    a-b
    b-c(expression="x=1")
    `
  );
  const wf1_ignored = generateWorkflow(
    `
    @name wf-1
    @id workflow-id 
    @unknownfield some-value
    a-b
    b-c(expression="x=1")
    `
  );
  t.is(generateHash(wf1), generateHash(wf1_ignored));
});
