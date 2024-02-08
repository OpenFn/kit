import test from 'ava';
import type { ExecutionPlan } from '@openfn/lexicon';

import type {
  JobCompletePayload,
  JobStartPayload,
  WorkflowCompletePayload,
  WorkflowStartPayload,
} from '@openfn/engine-multi';
import create from '../../src/mock/runtime-engine';
import { waitForEvent, clone, createPlan } from '../util';
import { WorkflowErrorPayload } from '@openfn/engine-multi';

const sampleWorkflow = {
  id: 'w1',
  workflow: {
    steps: [
      {
        id: 'j1',
        adaptor: 'common@1.0.0',
        expression: 'fn(() => ({ data: { x: 10 } }))',
      },
    ],
  },
} as ExecutionPlan;

let engine: any;

test.before(async () => {
  engine = await create();
});

test.serial('getStatus() should should have no active workflows', async (t) => {
  const { active } = engine.getStatus();

  t.is(active, 0);
});

test.serial('Dispatch start events for a new workflow', async (t) => {
  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<WorkflowStartPayload>(
    engine,
    'workflow-start'
  );
  t.truthy(evt);
  t.is(evt.workflowId, 'w1');
});

test.serial('getStatus should report one active workflow', async (t) => {
  engine.execute(sampleWorkflow);

  const { active } = engine.getStatus();

  t.is(active, 1);
});

test.serial('Dispatch complete events when a workflow completes', async (t) => {
  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<WorkflowCompletePayload>(
    engine,
    'workflow-complete'
  );

  t.is(evt.workflowId, 'w1');
  t.truthy(evt.threadId);
});

test.serial('Dispatch start events for a job', async (t) => {
  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<JobStartPayload>(engine, 'job-start');
  t.truthy(evt);
  t.is(evt.workflowId, 'w1');
  t.is(evt.jobId, 'j1');
});

test.serial('Dispatch complete events for a job', async (t) => {
  engine.execute(sampleWorkflow);
  const evt = await waitForEvent<JobCompletePayload>(engine, 'job-complete');
  t.truthy(evt);
  t.is(evt.workflowId, 'w1');
  t.is(evt.jobId, 'j1');
  t.deepEqual(evt.state, { data: { x: 10 } });
});

test.serial('Dispatch error event for a crash', async (t) => {
  const wf = createPlan({
    id: 'j1',
    adaptor: 'common@1.0.0',
    expression: 'fn(() => ( @~!"@£!4 )',
  });

  engine.execute(wf);
  const evt = await waitForEvent<WorkflowErrorPayload>(
    engine,
    'workflow-error'
  );

  t.is(evt.workflowId, wf.id!);
  t.is(evt.type, 'RuntimeCrash');
  t.regex(evt.message, /invalid or unexpected token/i);
});

test.serial('wait function', async (t) => {
  const wf = createPlan({
    id: 'j1',
    expression: 'wait(100)',
  });
  engine.execute(wf);
  const start = Date.now();

  await waitForEvent<WorkflowCompletePayload>(engine, 'workflow-complete');

  const end = Date.now() - start;
  t.true(end > 90);
});

test.serial(
  'resolve credential before job-start if credential is a string',
  async (t) => {
    const wf = clone(sampleWorkflow);
    wf.id = t.title;
    wf.workflow.steps[0].configuration = 'x';

    let didCallCredentials;
    const credential = async () => {
      didCallCredentials = true;
      return {};
    };

    // @ts-ignore
    engine.execute(wf, {}, { resolvers: { credential } });

    await waitForEvent<JobStartPayload>(engine, 'job-start');
    t.true(didCallCredentials);
  }
);

test.serial('listen to events', async (t) => {
  const called = {
    'job-start': false,
    'job-complete': false,
    'workflow-log': false,
    'workflow-start': false,
    'workflow-complete': false,
  };

  const wf = createPlan({
    id: 'j1',
    adaptor: 'common@1.0.0',
    expression: 'export default [() => { console.log("x"); }]',
  });

  engine.listen(wf.id, {
    'job-start': ({ workflowId, jobId }: any) => {
      called['job-start'] = true;
      t.is(workflowId, wf.id);
      t.is(jobId, wf.workflow.steps[0].id);
    },
    'job-complete': ({ workflowId, jobId }: any) => {
      called['job-complete'] = true;
      t.is(workflowId, wf.id);
      t.is(jobId, wf.workflow.steps[0].id);
      // TODO includes state?
    },
    'workflow-log': ({ workflowId, message }: any) => {
      called['workflow-log'] = true;
      t.is(workflowId, wf.id);
      t.truthy(message);
    },
    'workflow-start': ({ workflowId }: any) => {
      called['workflow-start'] = true;
      t.is(workflowId, wf.id);
    },
    'workflow-complete': ({ workflowId }: any) => {
      called['workflow-complete'] = true;
      t.is(workflowId, wf.id);
    },
  });

  engine.execute(wf);
  await waitForEvent<WorkflowCompletePayload>(engine, 'workflow-complete');
  t.assert(Object.values(called).every((v) => v === true));
});

test.serial('only listen to events for the correct workflow', async (t) => {
  engine.listen('bobby mcgee', {
    'workflow-start': () => {
      throw new Error('should not have called this!!');
    },
  });

  engine.execute(sampleWorkflow);
  await waitForEvent<WorkflowCompletePayload>(engine, 'workflow-complete');
  t.pass();
});

test.serial('log events should stringify a string message', async (t) => {
  const wf = clone(sampleWorkflow);
  wf.id = t.title;
  wf.workflow.steps[0].expression =
    'fn((s) => {console.log("haul away joe"); return s; })';

  engine.listen(wf.id, {
    'workflow-log': ({ message }: any) => {
      t.is(typeof message, 'string');
      const result = JSON.parse(message);
      t.deepEqual(result, ['haul away joe']);
    },
  });

  engine.execute(wf);
  await waitForEvent<WorkflowCompletePayload>(engine, 'workflow-complete');
});

test.serial('log events should stringify an object message', async (t) => {
  const wf = clone(sampleWorkflow);
  wf.id = t.title;
  wf.workflow.steps[0].expression =
    'fn((s) => {console.log({ x: 22 }); return s; })';

  engine.listen(wf.id, {
    'workflow-log': ({ message }: any) => {
      t.is(typeof message, 'string');
      const result = JSON.parse(message);
      t.deepEqual(result, [{ x: 22 }]);
    },
  });

  engine.execute(wf);
  await waitForEvent<WorkflowCompletePayload>(engine, 'workflow-complete');
});

test.serial(
  'do nothing for a job if no expression and adaptor (trigger node)',
  async (t) => {
    // @ts-ignore
    const workflow = createPlan({
      id: 'j1',
      adaptor: '@openfn/language-common@1.0.0',
    });

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
    await waitForEvent<WorkflowCompletePayload>(engine, 'workflow-complete');

    t.false(didCallEvent);
  }
);

test.skip('timeout', async (t) => {
  const wf = clone(sampleWorkflow);
  wf.workflow.steps[0].expression = 'wait(1000)';

  // @ts-ignore
  engine.execute(wf, {}, { timeout: 10 });

  const evt = await waitForEvent<WorkflowErrorPayload>(
    engine,
    'workflow-error'
  );
  t.is(evt.type, 'TimeoutError');
});
