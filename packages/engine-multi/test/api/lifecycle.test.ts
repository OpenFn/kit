import test from 'ava';

import * as e from '../../src/events';
import { createMockLogger } from '@openfn/logger';
import {
  log,
  workflowComplete,
  workflowStart,
  jobStart,
  jobComplete,
  error,
} from '../../src/api/lifecycle';
import { WorkflowState } from '../../src/types';
import ExecutionContext from '../../src/classes/ExecutionContext';

const createContext = (workflowId: string, state?: any) =>
  new ExecutionContext({
    state: state || { id: workflowId },
    logger: createMockLogger(),
    callWorker: () => {},
    options: {},
  });

test(`workflowStart: emits ${e.WORKFLOW_START}`, (t) => {
  return new Promise((done) => {
    const workflowId = 'a';

    const context = createContext(workflowId);
    const event = { workflowId, threadId: '123' };

    context.on(e.WORKFLOW_START, (evt) => {
      t.deepEqual(evt, event);
      done();
    });

    workflowStart(context, event);
  });
});

test('onWorkflowStart: updates state', (t) => {
  const workflowId = 'a';

  const context = createContext(workflowId);
  const event = { workflowId, threadId: '123' };

  workflowStart(context, event);

  const { state } = context;
  t.is(state.status, 'running');
  t.is(state.duration, -1);
  t.is(state.threadId, '123');
  t.truthy(state.startTime);
});

test.todo('onWorkflowStart: logs');
test.todo('onWorkflowStart: throws if the workflow is already started');

test(`workflowComplete: emits ${e.WORKFLOW_COMPLETE}`, (t) => {
  return new Promise((done) => {
    const workflowId = 'a';
    const result = { a: 777 };

    const state = {
      id: workflowId,
      startTime: Date.now() - 1000,
    } as WorkflowState;
    const context = createContext(workflowId, state);

    const event = { workflowId, state: result, threadId: '1' };

    context.on(e.WORKFLOW_COMPLETE, (evt) => {
      t.is(evt.workflowId, workflowId);
      t.deepEqual(evt.state, result);
      t.assert(evt.duration > 0);
      done();
    });

    workflowComplete(context, event);
  });
});

test('workflowComplete: updates state', (t) => {
  const workflowId = 'a';
  const result = { a: 777 };

  const state = {
    id: workflowId,
    startTime: Date.now() - 1000,
  } as WorkflowState;
  const context = createContext(workflowId, state);
  const event = { workflowId, state: result, threadId: '1' };

  workflowComplete(context, event);

  t.is(state.status, 'done');
  t.assert(state.duration! > 0);
  t.deepEqual(state.result, result);
});

test(`job-start: emits ${e.JOB_START}`, (t) => {
  return new Promise((done) => {
    const workflowId = 'a';

    const state = {
      id: workflowId,
      startTime: Date.now() - 1000,
    } as WorkflowState;

    const context = createContext(workflowId, state);

    const event = {
      workflowId,
      threadId: '1',
      jobId: 'j',
    };

    context.on(e.JOB_START, (evt) => {
      t.is(evt.workflowId, workflowId);
      t.is(evt.threadId, '1');
      t.is(evt.jobId, 'j');
      done();
    });

    jobStart(context, event);
  });
});

test(`job-complete: emits ${e.JOB_COMPLETE}`, (t) => {
  return new Promise((done) => {
    const workflowId = 'a';

    const state = {
      id: workflowId,
      startTime: Date.now() - 1000,
    } as WorkflowState;

    const context = createContext(workflowId, state);

    const event = {
      workflowId,
      threadId: '1',
      jobId: 'j',
      duration: 200,
      state: 22,
      next: [],
      mem: { job: 100, system: 1000 },
    };

    context.on(e.JOB_COMPLETE, (evt) => {
      t.is(evt.workflowId, workflowId);
      t.is(evt.threadId, '1');
      t.is(evt.jobId, 'j');
      t.is(evt.state, 22);
      t.is(evt.duration, 200);
      t.deepEqual(evt.next, []);
      t.deepEqual(evt.mem, event.mem);
      done();
    });

    jobComplete(context, event);
  });
});

test(`log: emits ${e.WORKFLOW_LOG}`, (t) => {
  return new Promise((done) => {
    const workflowId = 'a';

    const context = createContext(workflowId);

    const event = {
      workflowId,
      threadId: 'a',
      message: {
        level: 'info',
        name: 'job',
        message: ['oh hai'],
        time: Date.now() - 100,
      },
    };

    context.on(e.WORKFLOW_LOG, (evt) => {
      t.deepEqual(evt, {
        workflowId,
        threadId: 'a',
        ...event.message,
      });
      done();
    });

    log(context, event);
  });
});

// TODO not a very thorough test, still not really sure what I'm doing here
test(`error: emits ${e.WORKFLOW_ERROR}`, (t) => {
  return new Promise((done) => {
    const workflowId = 'a';

    const context = createContext(workflowId);
    context.on(e.WORKFLOW_ERROR, (evt) => {
      t.is(evt.message, 'test');
      t.is(evt.workflowId, 'a');

      done();
    });

    const err = new Error('test');

    error(context, { error: err });
  });
});
