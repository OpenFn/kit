import test from 'ava';
import onRunError from '../../src/events/run-error';

import { mockChannel } from '../../src/mock/sockets';
import { RUN_COMPLETE, RUN_LOG, STEP_COMPLETE } from '../../src/events';
import { createRunState } from '../../src/util';

const plan = { id: 'run-1', workflow: { steps: [] }, options: {} };

test('runError should trigger runComplete with a reason', async (t) => {
  const jobId = 'job-1';

  const state = createRunState(plan);
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

  const event: any = {
    severity: 'crash',
    type: 'Err',
    message: 'it crashed',
  };

  const context = { channel, state, onFinish: () => {} };

  await onRunError(context as any, event);
});

test('workflow error should send reason to onFinish', async (t) => {
  const jobId = 'job-1';

  const state = createRunState(plan);
  state.lastDataclipId = 'x';
  state.activeStep = 'b';
  state.activeJob = jobId;

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [STEP_COMPLETE]: () => true,
    [RUN_COMPLETE]: () => true,
  });

  const event: any = {
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
    onFinish: (evt: any) => {
      t.is(evt.reason.reason, 'crash');
    },
  };

  await onRunError(context as any, event);
});

test('runError should not call job complete if the job is not active', async (t) => {
  const state = createRunState(plan);
  state.lastDataclipId = 'x';

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [STEP_COMPLETE]: () => {
      t.fail('should not call!');
      return true;
    },
    [RUN_COMPLETE]: () => true,
  });

  const event: any = {
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

  await onRunError(context as any, event);
});

test('runError should log the reason', async (t) => {
  const jobId = 'job-1';

  const state = createRunState({
    id: 'run-1',
    workflow: {
      steps: [{ id: 'job-1' }],
    },
    options: {},
  });
  state.lastDataclipId = 'x';
  state.activeStep = 'b';
  state.activeJob = jobId;

  const event: any = {
    severity: 'crash',
    type: 'Err',
    message: 'it crashed',
  };
  state.reasons['x'] = event;

  let logEvents: any[] = [];

  const channel = mockChannel({
    [RUN_LOG]: (e) => {
      logEvents.push(e);
    },
    [STEP_COMPLETE]: () => true,
    [RUN_COMPLETE]: () => true,
  });

  const context = { channel, state, onFinish: () => {} };

  await onRunError(context as any, event);
  t.is(logEvents[0].message[0], 'Run complete with status: crash');
  t.is(logEvents[1].message[0], 'Err: it crashed');
});
