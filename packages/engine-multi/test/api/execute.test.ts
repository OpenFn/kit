import path from 'node:path';
import test from 'ava';
import { EventEmitter } from 'node:events';
import { EngineAPI } from '../../src/types';
import initWorkers from '../../src/api/call-worker';
import execute from '../../src/api/execute';
import { createMockLogger } from '@openfn/logger';
import {
  WORKFLOW_COMPLETE,
  WORKFLOW_LOG,
  WORKFLOW_START,
} from '../../src/events';

const workerPath = path.resolve('dist/mock-worker.js');

// Mock API object
let api;

test.before(() => {
  api = new EventEmitter() as EngineAPI;
  api.logger = createMockLogger();

  initWorkers(api, workerPath);
});

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
    handleInstall: async () => false,
    handleIsInstalled: async () => false,
  },
};

test.serial('execute should run a job and return the result', async (t) => {
  const state = {
    plan,
  };

  const options = {
    noCompile: true,
    autoinstall: {
      handleInstall: async () => false,
      handleIsInstalled: async () => false,
    },
  };

  const result = await execute(api, state, options);
  t.is(result, 22);
});

// we can check the state object after each of these is returned
test.serial('should emit a workflow-start event', async (t) => {
  let workflowStart;

  api.once(WORKFLOW_START, (evt) => (workflowStart = evt));

  const state = {
    plan,
  };

  await execute(api, state, options);

  // No need to do a deep test of the event payload here
  t.is(workflowStart.workflowId, 'x');
});

test.serial('should emit a workflow-complete event', async (t) => {
  let workflowComplete;

  api.once(WORKFLOW_COMPLETE, (evt) => (workflowComplete = evt));

  const state = {
    plan,
  };

  await execute(api, state, options);

  t.is(workflowComplete.workflowId, 'x');
  t.is(workflowComplete.state, 22);
});

test.serial('should emit a log event', async (t) => {
  let workflowLog;

  api.once(WORKFLOW_LOG, (evt) => (workflowLog = evt));

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
  };

  await execute(api, state, options);

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
