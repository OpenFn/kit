import test from 'ava';
import { EventEmitter } from 'node:events';

import * as e from '../../src/events';
import { createMockLogger } from '@openfn/logger';
import { log, workflowComplete, workflowStart } from '../../src/api/lifecycle';
import { EngineAPI, ExecutionContext, WorkflowState } from '../../src/types';

const createContext = ({ state }: Partial<ExecutionContext> = {}) => {
  const api = new EventEmitter();
  return Object.assign(api, {
    logger: createMockLogger(),
    state: state || {},
    // logger: not used
  }) as unknown as ExecutionContext;
};

test(`workflowStart: emits ${e.WORKFLOW_START}`, (t) => {
  return new Promise((done) => {
    const workflowId = 'a';

    const context = createContext();
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

  const context = createContext();
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
      startTime: Date.now() - 1000,
    } as WorkflowState;
    const context = createContext({ state });

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
    startTime: Date.now() - 1000,
  } as WorkflowState;
  const context = createContext({ state });
  const event = { workflowId, state: result, threadId: '1' };

  workflowComplete(context, event);

  t.is(state.status, 'done');
  t.assert(state.duration! > 0);
  t.deepEqual(state.result, result);
});

test(`log: emits ${e.WORKFLOW_LOG}`, (t) => {
  return new Promise((done) => {
    const workflowId = 'a';

    const state = {
      id: workflowId,
    } as WorkflowState;
    const context = createContext({ state });

    const event = {
      workflowId,
      message: {
        level: 'info',
        name: 'job',
        message: ['oh hai'],
        time: Date.now() - 100,
      },
    };

    context.on(e.WORKFLOW_LOG, (evt) => {
      t.deepEqual(evt, {
        workflowId: state.id,
        ...event.message,
      });
      done();
    });

    log(context, event);
  });
});
