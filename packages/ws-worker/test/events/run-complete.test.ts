import test from 'ava';
import handleRunComplete from '../../src/events/run-complete';

import { mockChannel } from '../../src/mock/sockets';
import { RUN_COMPLETE, RUN_LOG } from '../../src/events';
import { createRunState } from '../../src/util';
import { createPlan } from '../util';

test('should send an run:complete event', async (t) => {
  const result = { answer: 42 };
  const plan = createPlan();

  const state = createRunState(plan);
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

  const event: any = {};

  const context: any = { channel, state, onFinish: () => {} };
  await handleRunComplete(context, event);
});

test('should call onFinish with final dataclip', async (t) => {
  const result = { answer: 42 };
  const plan = createPlan();

  const state = createRunState(plan);
  state.dataclips = {
    x: result,
  };
  state.lastDataclipId = 'x';

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
  state.dataclips = {
    x: result,
  };
  state.lastDataclipId = 'x';

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

  t.is(logEvent.message[0], 'Run complete with status: success');
  t.is(completeEvent.reason, 'success');
  t.falsy(completeEvent.error_type);
  t.falsy(completeEvent.error_message);
});

test('should send a reason log and return reason for fail', async (t) => {
  const result = { answer: 42 };
  const plan = createPlan({ id: 'x', expression: '.' });

  const state = createRunState(plan);
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

  t.is(logEvent.message[0], 'Run complete with status: fail\nTEST: err');
  t.is(completeEvent.reason, 'fail');
  t.is(completeEvent.error_type, 'TEST');
  t.is(completeEvent.error_message, 'err');
});
