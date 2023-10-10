import test from 'ava';
import { EventEmitter } from 'node:events';

import * as e from '../../src/events';
import { createMockLogger } from '@openfn/logger';
import { log, workflowComplete, workflowStart } from '../../src/api/lifecycle';
import { EngineAPI, WorkflowState } from '../../src/types';

// TODO this probably wants unit testing
// is it even worth mocking it?
const createMockAPI = (): EngineAPI => {
  const api = new EventEmitter();

  Object.assign(api, {
    logger: createMockLogger(),
    getWorkflowState: () => {},
    setWorkflowState: () => {},
  });

  return api as EngineAPI;
};

test(`workflowStart: emits ${e.WORKFLOW_START}`, (t) => {
  return new Promise((done) => {
    const workflowId = 'a';

    const api = createMockAPI();
    const state = {} as WorkflowState;
    const event = { workflowId, threadId: '123' };

    api.on(e.WORKFLOW_START, (evt) => {
      t.deepEqual(evt, { workflowId });
      done();
    });

    workflowStart(api, state, event);
  });
});

test('onWorkflowStart: updates state', (t) => {
  const workflowId = 'a';

  const api = createMockAPI();
  const state = {} as WorkflowState;
  const event = { workflowId, threadId: '123' };

  workflowStart(api, state, event);

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

    const api = createMockAPI();
    const state = {
      startTime: Date.now() - 1000,
    } as WorkflowState;

    const event = { workflowId, state: result };

    api.on(e.WORKFLOW_COMPLETE, (evt) => {
      t.is(evt.workflowId, workflowId);
      t.deepEqual(evt.state, result);
      t.assert(evt.duration > 0);
      done();
    });

    workflowComplete(api, state, event);
  });
});

test('workflowComplete: updates state', (t) => {
  const workflowId = 'a';
  const result = { a: 777 };

  const api = createMockAPI();
  const state = {
    startTime: Date.now() - 1000,
  } as WorkflowState;
  const event = { workflowId, state: result };

  workflowComplete(api, state, event);

  t.is(state.status, 'done');
  t.assert(state.duration! > 0);
  t.deepEqual(state.result, result);
});

test(`log: emits ${e.WORKFLOW_LOG}`, (t) => {
  return new Promise((done) => {
    const workflowId = 'a';

    const api = createMockAPI();
    const state = {
      id: workflowId,
    } as WorkflowState;

    const event = {
      workflowId,
      message: {
        level: 'info',
        name: 'job',
        message: ['oh hai'],
        time: Date.now() - 100,
      },
    };

    api.on(e.WORKFLOW_LOG, (evt) => {
      t.deepEqual(evt, {
        workflowId: state.id,
        ...event.message,
      });
      done();
    });

    log(api, state, event);
  });
});
