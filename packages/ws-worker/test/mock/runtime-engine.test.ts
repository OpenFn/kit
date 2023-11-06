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

test('getStatus() should should have no active workflows', async (t) => {
  const engine = await create();
  const { active } = engine.getStatus();

  t.is(active, 0);
});

test('Dispatch start events for a new workflow', async (t) => {
  const engine = await create();

  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<WorkflowStartEvent>(engine, 'workflow-start');
  t.truthy(evt);
  t.is(evt.workflowId, 'w1');
});

test('getStatus should report one active workflow', async (t) => {
  const engine = await create();
  engine.execute(sampleWorkflow);

  const { active } = engine.getStatus();

  t.is(active, 1);
});

test('Dispatch complete events when a workflow completes', async (t) => {
  const engine = await create();

  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<WorkflowCompleteEvent>(
    engine,
    'workflow-complete'
  );

  t.deepEqual(evt, { workflowId: 'w1' });
});

test('Dispatch start events for a job', async (t) => {
  const engine = await create();

  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<JobStartEvent>(engine, 'job-start');
  t.truthy(evt);
  t.is(evt.workflowId, 'w1');
  t.is(evt.jobId, 'j1');
});

test('Dispatch complete events for a job', async (t) => {
  const engine = await create();

  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<JobCompleteEvent>(engine, 'job-complete');
  t.truthy(evt);
  t.is(evt.workflowId, 'w1');
  t.is(evt.jobId, 'j1');
  t.truthy(evt.state);
});

test('mock should evaluate expressions as JSON', async (t) => {
  const engine = await create();

  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<JobCompleteEvent>(engine, 'job-complete');
  t.deepEqual(evt.state, { x: 10 });
});

test('mock should return initial state as result state', async (t) => {
  const engine = await create();

  const wf = {
    initialState: { y: 22 },
    jobs: [
      {
        adaptor: 'common@1.0.0',
      },
    ],
  };
  engine.execute(wf);

  const evt = await waitForEvent<JobCompleteEvent>(engine, 'job-complete');
  t.deepEqual(evt.state, { y: 22 });
});

test('mock prefers JSON state to initial state', async (t) => {
  const engine = await create();

  const wf = {
    initialState: { y: 22 },
    jobs: [
      {
        adaptor: 'common@1.0.0',
        expression: '{ "z": 33 }',
      },
    ],
  };
  engine.execute(wf);

  const evt = await waitForEvent<JobCompleteEvent>(engine, 'job-complete');
  t.deepEqual(evt.state, { z: 33 });
});

test('mock should dispatch log events when evaluating JSON', async (t) => {
  const engine = await create();

  const logs = [];
  engine.on('workflow-log', (l) => {
    logs.push(l);
  });

  engine.execute(sampleWorkflow);
  await waitForEvent<WorkflowCompleteEvent>(engine, 'workflow-complete');

  t.deepEqual(logs[0].message, ['Running job j1']);
  t.deepEqual(logs[1].message, ['Parsing expression as JSON state']);
});

test('mock should throw if the magic option is passed', async (t) => {
  const engine = await create();

  const logs = [];
  engine.on('workflow-log', (l) => {
    logs.push(l);
  });

  await t.throwsAsync(
    async () => engine.execute(sampleWorkflow, { throw: true }),
    {
      message: 'test error',
    }
  );
});

test('resolve credential before job-start if credential is a string', async (t) => {
  const wf = clone(sampleWorkflow);
  wf.jobs[0].configuration = 'x';

  let didCallCredentials;
  const credential = async (_id) => {
    didCallCredentials = true;
    return {};
  };

  const engine = await create();
  // @ts-ignore
  engine.execute(wf, { resolvers: { credential } });

  await waitForEvent<WorkflowCompleteEvent>(engine, 'job-start');
  t.true(didCallCredentials);
});

test('listen to events', async (t) => {
  const engine = await create();

  const called = {
    'job-start': false,
    'job-complete': false,
    'workflow-log': false,
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
    'workflow-log': ({ workflowId, message }) => {
      called['workflow-log'] = true;
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
  const engine = await create();

  engine.listen('bobby mcgee', {
    'workflow-start': ({ workflowId }) => {
      throw new Error('should not have called this!!');
    },
  });

  engine.execute(sampleWorkflow);
  await waitForEvent<WorkflowCompleteEvent>(engine, 'workflow-complete');
  t.pass();
});

test('do nothing for a job if no expression and adaptor (trigger node)', async (t) => {
  const workflow = {
    id: 'w1',
    jobs: [
      {
        id: 'j1',
      },
    ],
  } as ExecutionPlan;

  const engine = await create();

  let didCallEvent = false;

  engine.listen(workflow.id, {
    'job-start': () => {
      didCallEvent = true;
    },
    'job-complete': () => {
      didCallEvent = true;
    },
    'workflow-log': () => {
      // this can be called
    },
    'workflow-start': () => {
      // ditto
    },
    'workflow-complete': () => {
      // ditto
    },
  });

  engine.execute(workflow);
  await waitForEvent<WorkflowCompleteEvent>(engine, 'workflow-complete');

  t.false(didCallEvent);
});
