import test from 'ava';
import create, {
  JobCompleteEvent,
  JobStartEvent,
  WorkflowCompleteEvent,
  WorkflowStartEvent,
} from '../../src/mock/runtime-manager';
import type { ExecutionPlan } from '@openfn/runtime';
import { waitForEvent, clone } from '../util'; // ???

const sampleWorkflow = {
  id: 'w1',
  jobs: [
    {
      id: 'j1',
      adaptor: 'common@1.0.0',
      expression: '{ "x": 10 }',
    },
  ],
} as ExecutionPlan;

test('mock runtime manager should have an id', (t) => {
  const rtm = create(22);
  const keys = Object.keys(rtm);
  t.assert(rtm.id == 22);

  // No need to test the full API, just make sure it smells right
  t.assert(keys.includes('on'));
  t.assert(keys.includes('execute'));
});

test('getStatus() should should have no active workflows', (t) => {
  const rtm = create();
  const { active } = rtm.getStatus();

  t.is(active, 0);
});

test('Dispatch start events for a new workflow', async (t) => {
  const rtm = create();

  rtm.execute(sampleWorkflow);
  const evt = await waitForEvent<WorkflowStartEvent>(rtm, 'workflow-start');
  t.truthy(evt);
  t.is(evt.id, 'w1');
});

test('getStatus should report one active workflow', async (t) => {
  const rtm = create();
  rtm.execute(sampleWorkflow);

  const { active } = rtm.getStatus();

  t.is(active, 1);
});

test('Dispatch complete events when a workflow completes', async (t) => {
  const rtm = create();

  rtm.execute(sampleWorkflow);
  const evt = await waitForEvent<WorkflowCompleteEvent>(
    rtm,
    'workflow-complete'
  );

  t.truthy(evt);
  t.is(evt.id, 'w1');
  t.truthy(evt.state);
});

test('Dispatch start events for a job', async (t) => {
  const rtm = create();

  rtm.execute(sampleWorkflow);
  const evt = await waitForEvent<JobStartEvent>(rtm, 'job-start');
  t.truthy(evt);
  t.is(evt.id, 'j1');
  t.truthy(evt.runId);
});

test('Dispatch complete events for a job', async (t) => {
  const rtm = create();

  rtm.execute(sampleWorkflow);
  const evt = await waitForEvent<JobCompleteEvent>(rtm, 'job-complete');
  t.truthy(evt);
  t.is(evt.id, 'j1');
  t.truthy(evt.runId);
  t.truthy(evt.state);
});

test('mock should evaluate expressions as JSON', async (t) => {
  const rtm = create();

  rtm.execute(sampleWorkflow);
  const evt = await waitForEvent<WorkflowCompleteEvent>(
    rtm,
    'workflow-complete'
  );
  t.deepEqual(evt.state, { x: 10 });
});

test('resolve credential before job-start if credential is a string', async (t) => {
  const wf = clone(sampleWorkflow);
  wf.jobs[0].configuration = 'x';

  let didCallCredentials;
  const credentials = async (_id) => {
    didCallCredentials = true;
    return {};
  };

  const rtm = create(1, { credentials });
  rtm.execute(wf);

  await waitForEvent<WorkflowCompleteEvent>(rtm, 'job-start');
  t.true(didCallCredentials);
});
