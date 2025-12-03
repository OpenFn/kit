import path from 'node:path';
import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import initWorkers from '../../src/api/call-worker';
import execute from '../../src/api/execute';
import {
  JOB_COMPLETE,
  JOB_START,
  WORKFLOW_COMPLETE,
  WORKFLOW_ERROR,
  WORKFLOW_LOG,
  WORKFLOW_START,
} from '../../src/events';
import ExecutionContext from '../../src/classes/ExecutionContext';

import type {
  ExecuteOptions,
  ExecutionContextOptions,
  WorkflowState,
} from '../../src/types';
import type { EngineOptions } from '../../src/engine';

const workerPath = path.resolve('dist/test/mock-run.js');

const createContext = ({
  state,
  options,
}: {
  state: Partial<WorkflowState>;
  options: Partial<ExecutionContextOptions>;
}) => {
  const logger = createMockLogger();
  const { callWorker } = initWorkers(workerPath, {}, logger);

  const ctx = new ExecutionContext({
    // @ts-ignore
    state: state || { workflowId: 'x' },
    logger,
    callWorker,
    // @ts-ignore
    options,
  });

  ctx.callWorker = callWorker;

  return ctx;
};

const plan = {
  id: 'x',
  workflow: {
    steps: [
      {
        id: 'j',
        expression: '() => 22',
      },
    ],
  },
  options: {},
};

const options = {
  autoinstall: {
    handleInstall: async () => {},
    handleIsInstalled: async () => false,
  },
} as Partial<EngineOptions>;

test.serial('execute should run a job and return the result', async (t) => {
  const state = {
    id: 'x',
    plan,
  } as Partial<WorkflowState>;

  const context = createContext({ state, options });

  const result = await execute(context);
  t.is(result, 22);
});

// we can check the state object after each of these is returned
test.serial('should emit a workflow-start event', async (t) => {
  const state = {
    id: 'x',
    plan,
  } as WorkflowState;

  let workflowStart;

  const context = createContext({ state, options });

  context.once(WORKFLOW_START, (evt) => (workflowStart = evt));

  await execute(context);

  // No need to do a deep test of the event payload here
  t.is(workflowStart!.workflowId!, 'x');
  // Just a shallow test on the actual version object to verify that it's been attached
  t.truthy(workflowStart!.versions);
  t.regex(workflowStart!.versions.node, new RegExp(/(\d+).(\d+).\d+/));
});

test.serial('should emit a log event with the memory limit', async (t) => {
  const state = {
    id: 'x',
    plan,
  } as WorkflowState;

  const logs: any[] = [];

  const context = createContext({
    state,
    options: {
      ...options,
      memoryLimitMb: 666,
    },
  });

  context.on(WORKFLOW_LOG, (evt) => {
    logs.push(evt);
  });

  await execute(context);

  const logEvent = logs.find((evt) => evt.logs.some((l: any) => l.name === 'RTE'));
  const log = logEvent.logs.find((l: any) => l.name === 'RTE');
  t.is(log.message[0], 'Memory limit: 666mb');
});

test.serial('should emit a workflow-complete event', async (t) => {
  let workflowComplete;
  const state = {
    id: 'x',
    plan,
  } as WorkflowState;

  const context = createContext({ state, options });

  context.once(WORKFLOW_COMPLETE, (evt) => (workflowComplete = evt));

  await execute(context);

  t.is(workflowComplete!.workflowId, 'x');
  t.is(workflowComplete!.state, 22);
});

test.serial('should emit a job-start event', async (t) => {
  const state = {
    id: 'x',
    plan,
  } as WorkflowState;

  let event: any;

  const context = createContext({ state, options });

  context.once(JOB_START, (evt) => (event = evt));

  await execute(context);

  t.is(event.jobId, 'j');
});

test.serial('should emit a job-complete event', async (t) => {
  const state = {
    id: 'x',
    plan,
  } as WorkflowState;

  let event: any;

  const context = createContext({ state, options });

  context.once(JOB_COMPLETE, (evt) => (event = evt));

  await execute(context);

  t.is(event.jobId, 'j');
  t.is(event.state, 22);
  t.assert(!isNaN(event.duration));
});

test.serial('should emit a log event', async (t) => {
  let workflowLog: any;
  const plan = {
    id: 'y',
    workflow: {
      steps: [
        {
          expression: '() => { console.log("hi"); return 33 }',
        },
      ],
    },
    options: {},
  };
  const state = {
    id: 'y',
    plan,
  } as Partial<WorkflowState>;

  const context = createContext({ state, options });
  context.once(WORKFLOW_LOG, (evt) => (workflowLog = evt));

  await execute(context);

  t.is(workflowLog.workflowId, 'y');
  t.is(workflowLog.logs[0].level, 'info');
  t.deepEqual(workflowLog.logs[0].message, JSON.stringify(['hi']));
});

test.serial('log events are timestamped in hr time', async (t) => {
  let workflowLog: any;
  const plan = {
    id: 'y',
    workflow: {
      steps: [
        {
          expression: '() => { console.log("hi"); return 33 }',
        },
      ],
    },
  };
  const state = {
    id: 'y',
    plan,
  } as WorkflowState;

  const context = createContext({ state, options });
  context.once(WORKFLOW_LOG, (evt) => (workflowLog = evt));

  await execute(context);
  const { time } = workflowLog.logs[0];

  // Note: The time we get here is NOT a bigint because it's been serialized
  t.true(typeof time === 'string');
  t.is(time.length, 19);
});

test.serial('should emit error on timeout', async (t) => {
  const state = {
    id: 'zz',
    plan: {
      workflow: {
        steps: [
          {
            expression: '() => { while(true) {} }',
          },
        ],
      },
    },
  } as WorkflowState;

  const wfOptions: ExecuteOptions = {
    ...options,
    runTimeoutMs: 10,
  };

  let event: any;

  const context = createContext({ state, options: wfOptions });

  context.once(WORKFLOW_ERROR, (evt) => (event = evt));

  await execute(context);

  t.truthy(event.threadId);
  t.is(event.type, 'TimeoutError');
  t.regex(event.message, /failed to return within 10ms/);
});

test.serial(
  'should emit ExecutionError if something unexpected throws',
  async (t) => {
    const state = {
      id: 'baa',
      plan: {},
    } as WorkflowState;
    const context = createContext({ state, options });

    context.once(WORKFLOW_ERROR, (evt) => {
      t.is(evt.workflowId, state.id);
      // This occured in the main thread, good to know!
      t.is(evt.threadId, '-');

      t.is(evt.type, 'ExecutionError');
      t.regex(
        evt.message,
        /Cannot read properties of undefined \(reading 'repoDir'\)|Cannot destructure property \'repoDir\' of \'options\' as it is undefined\./
      );

      t.pass('error thrown');
    });

    // @ts-ignore
    delete context.options; // this will make it throw, poor little guy

    await execute(context);
  }
);

test.serial('should emit CompileError if compilation fails', async (t) => {
  const state = {
    id: 'baa',
    plan: {
      workflow: {
        steps: [{ id: 'j', expression: 'la la la' }],
      },
    },
  } as WorkflowState;
  const context = createContext({ state, options: {} });

  context.once(WORKFLOW_ERROR, (evt) => {
    t.is(evt.workflowId, state.id);
    t.true(typeof evt.threadId === 'number');

    t.is(evt.type, 'CompileError');
    t.is(evt.message, "j: Unexpected identifier 'la'");

    t.pass('error thrown');
  });

  await execute(context);
});

test.serial('should stringify the whitelist array', async (t) => {
  let passedOptions: any;

  const state = {
    id: 'x',
    plan,
  } as WorkflowState;

  const opts = {
    ...options,
    whitelist: [/abc/],
  };

  const context = createContext({ state, options: opts });
  // @ts-ignore
  context.callWorker = (_command, args) => {
    passedOptions = args[2];
  };

  await execute(context);

  t.truthy(passedOptions);
  t.deepEqual(passedOptions.whitelist, ['/abc/']);
});

test.serial('should forward the jobLogLevel option', async (t) => {
  let passedOptions: any;

  const state = {
    id: 'x',
    plan,
  } as WorkflowState;

  const opts = {
    ...options,
    jobLogLevel: 'none',
  };

  const context = createContext({ state, options: opts });
  // @ts-ignore
  context.callWorker = (_command, args) => {
    passedOptions = args[2];
  };

  await execute(context);

  t.truthy(passedOptions);
  t.deepEqual(passedOptions.jobLogLevel, 'none');
});
