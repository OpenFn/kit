import test from 'ava';
import handleAttemptComplete from '../../src/events/attempt-complete';

import { mockChannel } from '../../src/mock/sockets';
import { RUN_COMPLETE, RUN_LOG } from '../../src/events';
import { createAttemptState } from '../../src/util';

test('should send an run:complete event', async (t) => {
  const result = { answer: 42 };
  const plan = { id: 'attempt-1', jobs: [] };

  const state = createAttemptState(plan);
  state.dataclips = {
    x: result,
  };
  state.lastDataclipId = 'x';

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [RUN_COMPLETE]: (evt) => {
      t.deepEqual(evt.final_dataclip_id, 'x');
    },
  });

  const event = {};

  const context = { channel, state, onFinish: () => {} };
  await handleAttemptComplete(context, event);
});

test('should call onFinish with final dataclip', async (t) => {
  const result = { answer: 42 };
  const plan = { id: 'attempt-1', jobs: [] };

  const state = createAttemptState(plan);
  state.dataclips = {
    x: result,
  };
  state.lastDataclipId = 'x';

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [RUN_COMPLETE]: () => true,
  });

  const context = {
    channel,
    state,
    onFinish: ({ state: finalState }) => {
      t.deepEqual(result, finalState);
    },
  };

  const event = { state: result };

  await handleAttemptComplete(context, event);
});

test('should send a reason log and return reason for success', async (t) => {
  const result = { answer: 42 };
  const plan = { id: 'attempt-1', jobs: [] };

  const state = createAttemptState(plan);
  state.dataclips = {
    x: result,
  };
  state.lastDataclipId = 'x';

  let logEvent;
  let completeEvent;

  const channel = mockChannel({
    [RUN_LOG]: (e) => {
      logEvent = e;
    },
    [RUN_COMPLETE]: (e) => {
      completeEvent = e;
    },
  });

  const context = {
    channel,
    state,
    onFinish: ({ state: finalState }) => {
      t.deepEqual(result, finalState);
    },
  };

  const event = { state: result };

  await handleAttemptComplete(context, event);

  t.is(logEvent.message[0], 'Run complete with status: success');
  t.is(completeEvent.reason, 'success');
  t.falsy(completeEvent.error_type);
  t.falsy(completeEvent.error_message);
});

test('should send a reason log and return reason for fail', async (t) => {
  const result = { answer: 42 };
  const plan = { id: 'attempt-1', jobs: [{ id: 'x' }] };

  const state = createAttemptState(plan);
  state.dataclips = {
    x: result,
  };
  state.lastDataclipId = 'x';
  state.reasons = {
    x: {
      reason: 'fail',
      error_message: 'err',
      error_type: 'TEST',
    },
  };

  let logEvent;
  let completeEvent;

  const channel = mockChannel({
    [RUN_LOG]: (e) => {
      logEvent = e;
    },
    [RUN_COMPLETE]: (e) => {
      completeEvent = e;
    },
  });

  const context = {
    channel,
    state,
    onFinish: ({ state: finalState }) => {
      t.deepEqual(result, finalState);
    },
  };

  const event = { state: result };

  await handleAttemptComplete(context, event);

  t.is(logEvent.message[0], 'Run complete with status: fail\nTEST: err');
  t.is(completeEvent.reason, 'fail');
  t.is(completeEvent.error_type, 'TEST');
  t.is(completeEvent.error_message, 'err');
});
