import test from 'ava';
import onAttemptError from '../../src/events/attempt-error';

import { mockChannel } from '../../src/mock/sockets';
import { RUN_COMPLETE, RUN_LOG, STEP_COMPLETE } from '../../src/events';
import { createAttemptState } from '../../src/util';

const plan = { id: 'attempt-1', jobs: [] };

test('attemptError should trigger runComplete with a reason', async (t) => {
  const jobId = 'job-1';

  const state = createAttemptState(plan);
  state.lastDataclipId = 'x';
  state.activeStep = 'b';
  state.activeJob = jobId;

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [STEP_COMPLETE]: (evt) => {
      t.is(evt.reason, 'crash');
      t.is(evt.error_message, 'it crashed');
      return true;
    },
    [RUN_COMPLETE]: () => true,
  });

  const event = {
    severity: 'crash',
    type: 'Err',
    message: 'it crashed',
  };

  const context = { channel, state, onFinish: () => {} };

  await onAttemptError(context, event);
});

test('workflow error should send reason to onFinish', async (t) => {
  const jobId = 'job-1';

  const state = createAttemptState(plan);
  state.lastDataclipId = 'x';
  state.activeStep = 'b';
  state.activeJob = jobId;

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [STEP_COMPLETE]: (evt) => true,
    [RUN_COMPLETE]: () => true,
  });

  const event = {
    error: {
      severity: 'crash',
      type: 'Err',
      message: 'it crashed',
    },
    state: {},
  };

  const context = {
    channel,
    state,
    onFinish: (evt) => {
      t.is(evt.reason.reason, 'crash');
    },
  };

  await onAttemptError(context, event);
});

test('attemptError should not call job complete if the job is not active', async (t) => {
  const state = createAttemptState(plan);
  state.lastDataclipId = 'x';

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [STEP_COMPLETE]: (evt) => {
      t.fail('should not call!');
      return true;
    },
    [RUN_COMPLETE]: () => true,
  });

  const event = {
    error: {
      severity: 'crash',
      type: 'Err',
      message: 'it crashed',
    },
    state: {},
  };

  const context = {
    channel,
    state,
    onFinish: () => {
      t.pass();
    },
  };

  await onAttemptError(context, event);
});

test('attemptError should log the reason', async (t) => {
  const jobId = 'job-1';

  const state = createAttemptState({
    id: 'attempt-1',
    jobs: [{ id: 'job-1' }],
  });
  state.lastDataclipId = 'x';
  state.activeStep = 'b';
  state.activeJob = jobId;

  const event = {
    severity: 'crash',
    type: 'Err',
    message: 'it crashed',
  };
  state.reasons['x'] = event;

  let logEvent;

  const channel = mockChannel({
    [RUN_LOG]: (e) => {
      logEvent = e;
    },
    [STEP_COMPLETE]: (evt) => true,
    [RUN_COMPLETE]: () => true,
  });

  const context = { channel, state, onFinish: () => {} };

  await onAttemptError(context, event);
  t.is(logEvent.message[0], 'Run complete with status: crash\nErr: it crashed');
});
