import test from 'ava';
import create, {
  JobCompleteEvent,
  JobStartEvent,
  WorkflowCompleteEvent,
  WorkflowStartEvent,
} from '../../src/mock/runtime-engine';
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

test('mock runtime engine should have an id', (t) => {
  const engine = create('22');
  const keys = Object.keys(engine);
  t.assert(engine.id == '22');

  // No need to test the full API, just make sure it smells right
  t.assert(keys.includes('on'));
  t.assert(keys.includes('execute'));
});

test('getStatus() should should have no active workflows', (t) => {
  const engine = create();
  const { active } = engine.getStatus();

  t.is(active, 0);
});

test('Dispatch start events for a new workflow', async (t) => {
  const engine = create();

  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<WorkflowStartEvent>(engine, 'workflow-start');
  t.truthy(evt);
  t.is(evt.workflowId, 'w1');
});

test('getStatus should report one active workflow', async (t) => {
  const engine = create();
  engine.execute(sampleWorkflow);

  const { active } = engine.getStatus();

  t.is(active, 1);
});

test('Dispatch complete events when a workflow completes', async (t) => {
  const engine = create();

  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<WorkflowCompleteEvent>(
    engine,
    'workflow-complete'
  );

  t.truthy(evt);
  t.is(evt.workflowId, 'w1');
  t.truthy(evt.state);
});

test('Dispatch start events for a job', async (t) => {
  const engine = create();

  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<JobStartEvent>(engine, 'job-start');
  t.truthy(evt);
  t.is(evt.workflowId, 'w1');
  t.is(evt.jobId, 'j1');
});

test('Dispatch complete events for a job', async (t) => {
  const engine = create();

  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<JobCompleteEvent>(engine, 'job-complete');
  t.truthy(evt);
  t.is(evt.workflowId, 'w1');
  t.is(evt.jobId, 'j1');
  t.truthy(evt.state);
});

test('mock should evaluate expressions as JSON', async (t) => {
  const engine = create();

  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<WorkflowCompleteEvent>(
    engine,
    'workflow-complete'
  );
  t.deepEqual(evt.state, { x: 10 });
});

test('mock should dispatch log events when evaluating JSON', async (t) => {
  const engine = create();

  const logs = [];
  engine.on('log', (l) => {
    logs.push(l);
  });

  engine.execute(sampleWorkflow);
  await waitForEvent<WorkflowCompleteEvent>(engine, 'workflow-complete');

  t.deepEqual(logs[0].message, ['Running job j1']);
  t.deepEqual(logs[1].message, ['Parsing expression as JSON state']);
});

test('resolve credential before job-start if credential is a string', async (t) => {
  const wf = clone(sampleWorkflow);
  wf.jobs[0].configuration = 'x';

  let didCallCredentials;
  const credential = async (_id) => {
    didCallCredentials = true;
    return {};
  };

  const engine = create('1');
  // @ts-ignore
  engine.execute(wf, { credential });

  await waitForEvent<WorkflowCompleteEvent>(engine, 'job-start');
  t.true(didCallCredentials);
});

test('listen to events', async (t) => {
  const engine = create();

  const called = {
    'job-start': false,
    'job-complete': false,
    log: false,
    'workflow-start': false,
    'workflow-complete': false,
  };

  engine.listen(sampleWorkflow.id, {
    'job-start': ({ workflowId, jobId }) => {
      called['job-start'] = true;
      t.is(workflowId, sampleWorkflow.id);
      t.is(jobId, sampleWorkflow.jobs[0].id);
    },
    'job-complete': ({ workflowId, jobId }) => {
      called['job-complete'] = true;
      t.is(workflowId, sampleWorkflow.id);
      t.is(jobId, sampleWorkflow.jobs[0].id);
      // TODO includes state?
    },
    log: ({ workflowId, message }) => {
      called['log'] = true;
      t.is(workflowId, sampleWorkflow.id);
      t.truthy(message);
    },
    'workflow-start': ({ workflowId }) => {
      called['workflow-start'] = true;
      t.is(workflowId, sampleWorkflow.id);
    },
    'workflow-complete': ({ workflowId }) => {
      called['workflow-complete'] = true;
      t.is(workflowId, sampleWorkflow.id);
    },
  });

  engine.execute(sampleWorkflow);
  await waitForEvent<WorkflowCompleteEvent>(engine, 'workflow-complete');
  t.assert(Object.values(called).every((v) => v === true));
});

test('only listen to events for the correct workflow', async (t) => {
  const engine = create();

  engine.listen('bobby mcgee', {
    'workflow-start': ({ workflowId }) => {
      throw new Error('should not have called this!!');
    },
  });

  engine.execute(sampleWorkflow);
  await waitForEvent<WorkflowCompleteEvent>(engine, 'workflow-complete');
  t.pass();
});
