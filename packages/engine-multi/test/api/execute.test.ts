import path from 'node:path';
import test from 'ava';
import { EventEmitter } from 'node:events';
import { WorkflowState } from '../../src/types';
import initWorkers from '../../src/api/call-worker';
import execute from '../../src/api/execute';
import { createMockLogger } from '@openfn/logger';
import {
  WORKFLOW_COMPLETE,
  WORKFLOW_LOG,
  WORKFLOW_START,
} from '../../src/events';
import { RTEOptions } from '../../src/api';
import { ExecutionContext } from '../../src/engine';

const workerPath = path.resolve('dist/worker/mock.js');

const createContext = ({ state, options }) => {
  const ctx = new ExecutionContext({
    state: state || {},
    logger: createMockLogger(),
    callWorker: () => {},
    options,
  });
  initWorkers(ctx, workerPath);
  return ctx;
};

const plan = {
  id: 'x',
  jobs: [
    {
      // this will basically be evalled
      expression: '() => 22',
    },
  ],
};

const options = {
  noCompile: true,
  autoinstall: {
    handleInstall: async () => {},
    handleIsInstalled: async () => false,
  },
} as RTEOptions;

test.serial('execute should run a job and return the result', async (t) => {
  const state = {
    plan,
  } as WorkflowState;

  const context = createContext({ state, options });

  const result = await execute(context);
  t.is(result, 22);
});

// we can check the state object after each of these is returned
test.serial('should emit a workflow-start event', async (t) => {
  const state = {
    plan,
  } as WorkflowState;
  let workflowStart;

  const context = createContext({ state, options });

  context.once(WORKFLOW_START, (evt) => (workflowStart = evt));

  await execute(context);

  // No need to do a deep test of the event payload here
  t.is(workflowStart.workflowId, 'x');
});

test.serial('should emit a workflow-complete event', async (t) => {
  let workflowComplete;
  const state = {
    plan,
  } as WorkflowState;

  const context = createContext({ state, options });

  context.once(WORKFLOW_COMPLETE, (evt) => (workflowComplete = evt));

  await execute(context);

  t.is(workflowComplete.workflowId, 'x');
  t.is(workflowComplete.state, 22);
});

test.serial.only('should emit a log event', async (t) => {
  let workflowLog;
  const plan = {
    id: 'y',
    jobs: [
      {
        expression: '() => { console.log("hi"); return 33 }',
      },
    ],
  };
  const state = {
    id: 'y',
    plan,
  } as WorkflowState;

  const context = createContext({ state, options });
  context.once(WORKFLOW_LOG, (evt) => (workflowLog = evt));

  await execute(context);

  t.is(workflowLog.workflowId, 'y');
  t.is(workflowLog.message[0], 'hi');
  t.is(workflowLog.level, 'info');
});

// how will we test compilation?
// compile will call the actual runtime
// maybe that's fine?
test.todo('should compile');

// what are we actually testing here?
// ideally we wouldc ensure that autoinstall is called with the corret aguments
// we can pass in mock autoinstall handlers and ensure they're invoked
// maybe we can also test that the correct adaptorpaths are passed in to execute
test.todo('should autoinstall');
