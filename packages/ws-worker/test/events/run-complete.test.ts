import test from 'ava';
import { createMockLogger, timestamp } from '@openfn/logger';

import handleRunComplete from '../../src/events/run-complete';

import { mockChannel } from '../../src/mock/sockets';
import { RUN_COMPLETE, RUN_LOG } from '../../src/events';
import { createRunState } from '../../src/util';
import { createPlan } from '../util';

test('should send a run:complete event', async (t) => {
  const result = { answer: 42 };
  const plan = createPlan();

  const state = createRunState(plan);

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [RUN_COMPLETE]: (evt) => {
      t.deepEqual(evt.final_state, result);
      t.falsy(evt.time); // if no timestamp in the engine event, no timestamp in the worker one
    },
  });

  const event: any = { state: result };

  const context: any = { channel, state, onFinish: () => {} };
  await handleRunComplete(context, event);
});

test('should include a timestamp', async (t) => {
  const plan = createPlan();

  const state = createRunState(plan);

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [RUN_COMPLETE]: (evt) => {
      t.assert(typeof evt.timestamp === 'string');
      t.is(evt.timestamp.length, 16);
    },
  });

  const event: any = {
    time: timestamp(),
  };

  t.is(event.time.toString().length, 19);

  const context: any = { channel, state, onFinish: () => {} };
  await handleRunComplete(context, event);
});

test('should call onFinish with final state', async (t) => {
  const result = { answer: 42 };
  const plan = createPlan();

  const state = createRunState(plan);

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [RUN_COMPLETE]: () => true,
  });

  const context: any = {
    channel,
    state,
    onFinish: ({ state: finalState }: any) => {
      t.deepEqual(result, finalState);
    },
  };

  const event: any = { state: result };

  await handleRunComplete(context, event);
});

test('should send a reason log and return reason for success', async (t) => {
  const result = { answer: 42 };
  const plan = createPlan();

  const state = createRunState(plan);

  let logEvent: any;
  let completeEvent: any;

  const channel = mockChannel({
    [RUN_LOG]: (e) => {
      logEvent = e;
    },
    [RUN_COMPLETE]: (e) => {
      completeEvent = e;
    },
  });

  const context: any = {
    channel,
    state,
    onFinish: ({ state: finalState }: any) => {
      t.deepEqual(result, finalState);
    },
  };

  const event: any = { state: result };

  await handleRunComplete(context, event);

  t.is(logEvent.logs[0].message[0], 'Run complete with status: success');
  t.is(completeEvent.reason, 'success');
  t.falsy(completeEvent.error_type);
  t.falsy(completeEvent.error_message);
});

test('should send a reason log and return reason for fail', async (t) => {
  t.plan(6);
  const result = { answer: 42 };
  const plan = createPlan({ id: 'x', expression: '.' });

  const state = createRunState(plan);
  state.reasons = {
    x: {
      reason: 'fail',
      error_message: 'err',
      error_type: 'TEST',
    },
  };

  let completeEvent: any;

  const channel = mockChannel({
    [RUN_LOG]: (e) => {
      if (e.logs[0].message[0].match(/run complete with status/i)) {
        t.is(e.logs[0].message[0], 'Run complete with status: fail');
      } else if (e.logs[0].message[0].match(/test: err/i)) {
        t.is(e.logs[0].message[0], 'TEST: err');
      }
    },
    [RUN_COMPLETE]: (e) => {
      completeEvent = e;
    },
  });

  const context: any = {
    channel,
    state,
    onFinish: ({ state: finalState }: any) => {
      t.deepEqual(result, finalState);
    },
  };

  const event: any = { state: result };

  await handleRunComplete(context, event);

  t.is(completeEvent.reason, 'fail');
  t.is(completeEvent.error_type, 'TEST');
  t.is(completeEvent.error_message, 'err');
});

test('should call onFinish even if the lightning event throws', async (t) => {
  const plan = createPlan();

  const state = createRunState(plan);

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [RUN_COMPLETE]: () => {
      throw new Error('they came from... behind!');
    },
  });

  const event: any = { state: {} };

  const logger = createMockLogger();

  const context: any = {
    channel,
    state,
    onFinish: () => {
      t.pass('On finish called');
    },
    logger,
  };
  await handleRunComplete(context, event);
});

test('should log if the lightning event throws', async (t) => {
  const plan = createPlan();

  const state = createRunState(plan);

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [RUN_COMPLETE]: () => {
      throw new Error('they came from... behind!');
    },
  });

  const event: any = { state: {} };

  const logger = createMockLogger();

  const context: any = {
    channel,
    state,
    onFinish: () => {
      const message = logger._find(
        'error',
        /failed to send run:complete event/
      );
      t.truthy(message);
    },
    logger,
  };
  await handleRunComplete(context, event);
});

test('should call onFinish even if the lightning event timesout', async (t) => {
  const plan = createPlan();

  const state = createRunState(plan);

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    // no event handler is registered, so the mock will throw a timeout
  });

  const event: any = { state: {} };

  const logger = createMockLogger();

  const context: any = {
    channel,
    state,
    onFinish: () => {
      t.pass('On finish called');
    },
    logger,
  };
  await handleRunComplete(context, event);
});

test('should send final_state for a linear workflow', async (t) => {
  const plan = createPlan();
  const state = createRunState(plan);
  const finalResult = { data: { count: 100 }, references: [] };

  let completeEvent: any;

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [RUN_COMPLETE]: (evt) => {
      completeEvent = evt;
    },
  });

  const context: any = {
    channel,
    state,
    onFinish: () => {},
  };

  const event: any = { state: finalResult };

  await handleRunComplete(context, event);

  t.deepEqual(completeEvent.final_state, finalResult);
  t.is(completeEvent.reason, 'success');
});

test('should send final_state for a branching workflow with multiple leaf nodes', async (t) => {
  const plan = createPlan();
  const state = createRunState(plan);

  // Simulate a branching workflow with multiple final states
  const branchedResult = {
    'job-1': { data: { path: 'A', value: 42 } },
    'job-2': { data: { path: 'B', value: 84 } },
    'job-3': { data: { path: 'C', value: 126 } },
  };

  let completeEvent: any;

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [RUN_COMPLETE]: (evt) => {
      completeEvent = evt;
    },
  });

  const context: any = {
    channel,
    state,
    onFinish: ({ state: finalState }: any) => {
      // Verify that onFinish receives the branched result
      t.deepEqual(finalState, branchedResult);
    },
  };

  const event: any = { state: branchedResult };

  await handleRunComplete(context, event);

  // Verify the event contains the full branched state structure
  t.deepEqual(completeEvent.final_state, branchedResult);
  t.is(completeEvent.reason, 'success');
  t.truthy(completeEvent.final_state['job-1']);
  t.truthy(completeEvent.final_state['job-2']);
  t.truthy(completeEvent.final_state['job-3']);
});

test('should properly serialize final_state as JSON', async (t) => {
  const plan = createPlan();
  const state = createRunState(plan);

  // Test with complex state including nested objects, arrays, and special values
  const complexState = {
    data: {
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
      metadata: {
        timestamp: new Date('2024-01-01').toISOString(),
        nested: { deeply: { value: 42 } },
      },
    },
    configuration: { setting: true },
    references: [],
  };

  let completeEvent: any;

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [RUN_COMPLETE]: (evt) => {
      completeEvent = evt;
    },
  });

  const context: any = {
    channel,
    state,
    onFinish: () => {},
  };

  const event: any = { state: complexState };

  await handleRunComplete(context, event);

  // Verify the state is properly preserved
  t.deepEqual(completeEvent.final_state, complexState);
  t.deepEqual(completeEvent.final_state.data.users[0], { id: 1, name: 'Alice' });
  t.is(completeEvent.final_state.data.metadata.nested.deeply.value, 42);

  // Verify it can be stringified (simulating what happens when sent over the wire)
  const jsonString = JSON.stringify(completeEvent.final_state);
  const parsed = JSON.parse(jsonString);
  t.deepEqual(parsed, complexState);
});

test('should handle Uint8Array in final_state', async (t) => {
  const plan = createPlan();
  const state = createRunState(plan);

  // Test with Uint8Array which needs special handling
  const stateWithBinary = {
    data: { buffer: new Uint8Array([1, 2, 3, 4, 5]) },
  };

  let completeEvent: any;

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [RUN_COMPLETE]: (evt) => {
      completeEvent = evt;
    },
  });

  const context: any = {
    channel,
    state,
    onFinish: () => {},
  };

  const event: any = { state: stateWithBinary };

  await handleRunComplete(context, event);

  // Verify the Uint8Array is preserved in the event
  t.deepEqual(completeEvent.final_state.data.buffer, new Uint8Array([1, 2, 3, 4, 5]));
});
