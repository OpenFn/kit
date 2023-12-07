import test from 'ava';
import handleRunStart from '../../src/events/run-complete';

import { mockChannel } from '../../src/mock/sockets';
import { createAttemptState } from '../../src/util';
import { RUN_COMPLETE } from '../../src/events';

import type { ExecutionPlan } from '@openfn/runtime';

test('clear the run id and active job on state', async (t) => {
  const plan = { id: 'attempt-1' };
  const jobId = 'job-1';

  const state = createAttemptState(plan);
  state.activeJob = jobId;
  state.activeRun = 'b';

  const channel = mockChannel({
    [RUN_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 } };
  await handleRunStart({ channel, state }, event);

  t.falsy(state.activeJob);
  t.falsy(state.activeRun);
});

test('setup input mappings on on state', async (t) => {
  let lightningEvent;
  const plan = { id: 'attempt-1' };
  const jobId = 'job-1';

  const state = createAttemptState(plan);
  state.activeJob = jobId;
  state.activeRun = 'b';

  const channel = mockChannel({
    [RUN_COMPLETE]: (evt) => {
      lightningEvent = evt;
    },
  });

  const engineEvent = { state: { x: 10 }, next: ['job-2'] };
  await handleRunStart({ channel, state }, engineEvent);

  t.deepEqual(state.inputDataclips, {
    ['job-2']: lightningEvent.output_dataclip_id,
  });
});

test('save the dataclip to state', async (t) => {
  const plan = { id: 'attempt-1' } as ExecutionPlan;
  const jobId = 'job-1';

  const state = createAttemptState(plan);
  state.activeJob = jobId;
  state.activeRun = 'b';

  const channel = mockChannel({
    [RUN_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 } };
  await handleRunStart({ channel, state }, event);

  t.is(Object.keys(state.dataclips).length, 1);
  const [dataclip] = Object.values(state.dataclips);
  t.deepEqual(dataclip, event.state);
});

test('write a reason to state', async (t) => {
  const plan = { id: 'attempt-1' } as ExecutionPlan;
  const jobId = 'job-1';

  const state = createAttemptState(plan);
  state.activeJob = jobId;
  state.activeRun = 'b';

  t.is(Object.keys(state.reasons).length, 0);

  const channel = mockChannel({
    [RUN_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 } };
  await handleRunStart({ channel, state }, event);

  t.is(Object.keys(state.reasons).length, 1);
  t.deepEqual(state.reasons[jobId], {
    reason: 'success',
    error_type: null,
    error_message: null,
  });
});

test('generate an exit reason: success', async (t) => {
  const plan = { id: 'attempt-1' } as ExecutionPlan;
  const jobId = 'job-1';

  const state = createAttemptState(plan);
  state.activeJob = jobId;
  state.activeRun = 'b';

  let event;

  const channel = mockChannel({
    [RUN_COMPLETE]: (e) => {
      event = e;
    },
  });

  await handleRunStart({ channel, state }, { state: { x: 10 } });

  t.truthy(event);
  t.is(event.reason, 'success');
  t.is(event.error_type, null);
  t.is(event.error_message, null);
});

test('send a run:complete event', async (t) => {
  const plan = { id: 'attempt-1' };
  const jobId = 'job-1';
  const result = { x: 10 };

  const state = createAttemptState(plan);
  state.activeJob = jobId;
  state.activeRun = 'b';

  const channel = mockChannel({
    [RUN_COMPLETE]: (evt) => {
      t.is(evt.job_id, jobId);
      t.truthy(evt.run_id);
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
  await handleRunStart({ channel, state }, event);
});
