import test from 'ava';
import handleStepStart from '../../src/events/step-complete';

import { mockChannel } from '../../src/mock/sockets';
import { createRunState } from '../../src/util';
import { STEP_COMPLETE } from '../../src/events';

import type { ExecutionPlan } from '@openfn/runtime';

test('clear the step id and active job on state', async (t) => {
  const plan = { id: 'run-1' };
  const jobId = 'job-1';

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  const channel = mockChannel({
    [STEP_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 } };
  await handleStepStart({ channel, state }, event);

  t.falsy(state.activeJob);
  t.falsy(state.activeStep);
});

test('setup input mappings on on state', async (t) => {
  let lightningEvent;
  const plan = { id: 'run-1' };
  const jobId = 'job-1';

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  const channel = mockChannel({
    [STEP_COMPLETE]: (evt) => {
      lightningEvent = evt;
    },
  });

  const engineEvent = { state: { x: 10 }, next: ['job-2'] };
  await handleStepStart({ channel, state }, engineEvent);

  t.deepEqual(state.inputDataclips, {
    ['job-2']: lightningEvent.output_dataclip_id,
  });
});

test('save the dataclip to state', async (t) => {
  const plan = { id: 'run-1' } as ExecutionPlan;
  const jobId = 'job-1';

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  const channel = mockChannel({
    [STEP_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 } };
  await handleStepStart({ channel, state }, event);

  t.is(Object.keys(state.dataclips).length, 1);
  const [dataclip] = Object.values(state.dataclips);
  t.deepEqual(dataclip, event.state);
});

test('write a reason to state', async (t) => {
  const plan = { id: 'run-1' } as ExecutionPlan;
  const jobId = 'job-1';

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  t.is(Object.keys(state.reasons).length, 0);

  const channel = mockChannel({
    [STEP_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 } };
  await handleStepStart({ channel, state }, event);

  t.is(Object.keys(state.reasons).length, 1);
  t.deepEqual(state.reasons[jobId], {
    reason: 'success',
    error_type: null,
    error_message: null,
  });
});

test('generate an exit reason: success', async (t) => {
  const plan = { id: 'run-1' } as ExecutionPlan;
  const jobId = 'job-1';

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  let event;

  const channel = mockChannel({
    [STEP_COMPLETE]: (e) => {
      event = e;
    },
  });

  await handleStepStart({ channel, state }, { state: { x: 10 } });

  t.truthy(event);
  t.is(event.reason, 'success');
  t.is(event.error_type, null);
  t.is(event.error_message, null);
});

test('send a step:complete event', async (t) => {
  const plan = { id: 'run-1' };
  const jobId = 'job-1';
  const result = { x: 10 };

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  const channel = mockChannel({
    [STEP_COMPLETE]: (evt) => {
      t.is(evt.job_id, jobId);
      t.truthy(evt.step_id);
      t.truthy(evt.output_dataclip_id);
      t.is(evt.output_dataclip, JSON.stringify(result));
      t.deepEqual(evt.mem, event.mem);
      t.is(evt.duration, event.duration);
      t.is(evt.thread_id, event.threadId);
    },
  });

  const event = {
    state: result,
    next: ['a'],
    mem: { job: 1, system: 10 },
    duration: 61,
    threadId: 'abc',
  };
  await handleStepStart({ channel, state }, event);
});
