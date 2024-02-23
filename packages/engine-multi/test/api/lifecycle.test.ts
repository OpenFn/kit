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
import * as w from '../../src/worker/events';

const createContext = (workflowId: string, state?: any) =>
  new ExecutionContext({
    state: state || { id: workflowId },
    logger: createMockLogger(),
    // @ts-ignore
    callWorker: () => {},
    // @ts-ignore
    options: {},
  });

test(`workflowStart: emits ${e.WORKFLOW_START}`, (t) => {
  return new Promise((done) => {
    const workflowId = 'a';

    const context = createContext(workflowId);
    const event: w.WorkflowStartEvent = {
      type: w.WORKFLOW_START,
      workflowId,
      threadId: '123',
    };

    context.on(e.WORKFLOW_START, (evt) => {
      t.truthy(evt.versions);
      t.is(evt.workflowId, workflowId);
      t.is(evt.threadId, '123');
      done();
    });

    workflowStart(context, event);
  });
});

test('onWorkflowStart: updates state', (t) => {
  const workflowId = 'a';

  const context = createContext(workflowId);
  const event: w.WorkflowStartEvent = {
    type: w.WORKFLOW_START,
    workflowId,
    threadId: '123',
  };

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

    const event: w.WorkflowCompleteEvent = {
      type: w.WORKFLOW_START,
      workflowId,
      state: result,
      threadId: '1',
    };

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
  const event: w.WorkflowCompleteEvent = {
    type: w.WORKFLOW_COMPLETE,
    workflowId,
    state: result,
    threadId: '1',
  };

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

    const event: w.JobStartEvent = {
      type: w.JOB_START,
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

    const event: w.JobCompleteEvent = {
      type: w.JOB_COMPLETE,
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

    const event: w.LogEvent = {
      type: w.LOG,
      workflowId,
      threadId: 'a',
      log: {
        level: 'info',
        name: 'job',
        message: JSON.stringify(['oh hai']),
        time: (Date.now() - 100).toString(),
      },
    };

    context.on(e.WORKFLOW_LOG, (evt) => {
      t.deepEqual(evt, {
        workflowId,
        threadId: 'a',
        ...event.log,
      });
      done();
    });

    log(context, event);
  });
});

test('logs get sent to stdout', (t) => {
  const workflowId = 'a';

  const stdout = createMockLogger(undefined, { level: 'debug', json: true });

  const context = createContext(workflowId);
  context.logger = stdout;

  const event: w.LogEvent = {
    type: w.LOG,
    workflowId,
    threadId: 'a',
    log: {
      level: 'info',
      name: 'r/t',
      message: ['oh hai'],
      time: (Date.now() - 100).toString(),
    },
  };

  log(context, event);

  const last: any = stdout._last;
  t.truthy(last);
  t.is(last.message[0], 'oh hai');
  t.is(last.name, 'r/t');
});

test('job logs do not get sent to stdout', (t) => {
  const workflowId = 'a';

  const stdout = createMockLogger(undefined, { level: 'debug' });

  const context = createContext(workflowId);
  context.logger = stdout;

  const event: w.LogEvent = {
    type: w.LOG,
    workflowId,
    threadId: 'a',
    log: {
      level: 'info',
      name: 'job',
      message: ['oh hai'],
      time: (Date.now() - 100).toString(),
    },
  };

  log(context, event);

  t.is(stdout._history.length, 0);
});

test('adaptor logs do not get sent to stdout', (t) => {
  const workflowId = 'a';

  const stdout = createMockLogger(undefined, { level: 'debug' });

  const context = createContext(workflowId);
  context.logger = stdout;

  const event: w.LogEvent = {
    type: w.LOG,
    workflowId,
    threadId: 'a',
    log: {
      level: 'info',
      name: 'ada',
      message: ['oh hai'],
      time: (Date.now() - 100).toString(),
    },
  };

  log(context, event);

  t.is(stdout._history.length, 0);
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

    // @ts-ignore
    error(context, { error: err });
  });
});
