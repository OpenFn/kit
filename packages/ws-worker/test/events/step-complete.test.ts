import test from 'ava';
import type { StepCompletePayload } from '@openfn/lexicon/lightning';

import handleStepComplete from '../../src/events/step-complete';
import { mockChannel } from '../../src/mock/sockets';
import { createRunState } from '../../src/util';
import { RUN_LOG, STEP_COMPLETE } from '../../src/events';
import { createPlan } from '../util';
import { JobCompletePayload } from '@openfn/engine-multi';
import { timestamp } from '@openfn/logger';

test('clear the step id and active job on state', async (t) => {
  const plan = createPlan();
  const jobId = 'job-1';

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  const channel = mockChannel({
    [STEP_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 } } as any;
  await handleStepComplete({ channel, state } as any, event);

  t.falsy(state.activeJob);
  t.falsy(state.activeStep);
});

test('setup input mappings on on state', async (t) => {
  let lightningEvent: any;
  const plan = createPlan();
  const jobId = 'job-1';

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  const channel = mockChannel({
    [STEP_COMPLETE]: (evt) => {
      lightningEvent = evt;
    },
  });

  const engineEvent = { state: { x: 10 }, next: ['job-2'] } as any;
  await handleStepComplete({ channel, state } as any, engineEvent);

  t.deepEqual(state.inputDataclips, {
    ['job-2']: lightningEvent.output_dataclip_id,
  });
});

test('save the dataclip to state', async (t) => {
  const plan = createPlan();
  const jobId = 'job-1';

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  const channel = mockChannel({
    [STEP_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 } } as any;
  await handleStepComplete({ channel, state } as any, event);

  t.is(Object.keys(state.dataclips).length, 1);
  const [dataclip] = Object.values(state.dataclips);
  t.deepEqual(dataclip, event.state);
});

test('write a reason to state', async (t) => {
  const plan = createPlan();
  const jobId = 'job-1';

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  t.is(Object.keys(state.reasons).length, 0);

  const channel = mockChannel({
    [STEP_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 } } as any;
  await handleStepComplete({ channel, state } as any, event);

  t.is(Object.keys(state.reasons).length, 1);
  t.deepEqual(state.reasons[jobId], {
    reason: 'success',
    error_type: null,
    error_message: null,
  });
});

test('generate an exit reason: success', async (t) => {
  const plan = createPlan();
  const jobId = 'job-1';

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  let event: any;

  const channel = mockChannel({
    [STEP_COMPLETE]: (e) => {
      event = e;
    },
  });

  await handleStepComplete(
    { channel, state } as any,
    { state: { x: 10 } } as any
  );

  t.truthy(event);
  t.is(event.reason, 'success');
  t.is(event.error_type, null);
  t.is(event.error_message, null);
});

test('send a step:complete event', async (t) => {
  const plan = createPlan();
  const jobId = 'job-1';
  const result = { x: 10 };

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  const channel = mockChannel({
    [STEP_COMPLETE]: (evt: StepCompletePayload) => {
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
    jobId,
    workflowId: plan.id,
    state: result,
    next: ['a'],
    mem: { job: 1, system: 10 },
    duration: 61,
    thread_id: 'abc',
    time: BigInt(123),
  } as JobCompletePayload;
  await handleStepComplete({ channel, state } as any, event);
});

test('do not include dataclips in step:complete if output_dataclip is false', async (t) => {
  const plan = createPlan();
  const jobId = 'job-1';
  const result = { x: 10 };

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  const options = {
    outputDataclips: false,
  };

  const channel = mockChannel({
    [STEP_COMPLETE]: (evt: StepCompletePayload) => {
      t.truthy(evt.output_dataclip_id);
      t.falsy(evt.output_dataclip);
    },
  });

  const event = {
    jobId,
    workflowId: plan.id,
    state: result,
    next: ['a'],
    mem: { job: 1, system: 10 },
    duration: 61,
    thread_id: 'abc',
    time: BigInt(123),
  } as JobCompletePayload;
  await handleStepComplete({ channel, state, options } as any, event);
});

test('do not include dataclips in step:complete if output_dataclip is too big', async (t) => {
  const plan = createPlan();
  const jobId = 'job-1';

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  const options = {
    payloadLimitMb: 1,
  };

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [STEP_COMPLETE]: (evt: StepCompletePayload) => {
      const clipId = state.inputDataclips['a'];
      t.true(state.withheldDataclips[clipId]);

      t.falsy(evt.output_dataclip_id);
      t.falsy(evt.output_dataclip);
      t.is(evt.output_dataclip_error, 'DATACLIP_TOO_LARGE');
    },
  });

  const event = {
    jobId,
    workflowId: plan.id,
    state: {},
    redacted: true,
    next: ['a'],
    mem: { job: 1, system: 10 },
    duration: 61,
    thread_id: 'abc',
    time: BigInt(123),
  } as JobCompletePayload;

  await handleStepComplete({ channel, state, options } as any, event);
});

test('log when the output_dataclip is too big', async (t) => {
  const plan = createPlan();
  const jobId = 'job-1';

  const state = createRunState(plan);
  state.activeJob = jobId;
  state.activeStep = 'b';

  const options = {};

  const channel = mockChannel({
    [RUN_LOG]: (e) => {
      t.regex(e.message[0], /dataclip exceeds payload limit/i);
    },
    [STEP_COMPLETE]: () => true,
  });

  const event = {
    jobId,
    workflowId: plan.id,
    redacted: true,
    state: {},
    next: ['a'],
    mem: { job: 1, system: 10 },
    duration: 61,
    thread_id: 'abc',
    time: BigInt(123),
  } as JobCompletePayload;

  await handleStepComplete({ channel, state, options } as any, event);
});

test('should include a timestamp', async (t) => {
  const plan = createPlan();
  const state = createRunState(plan);

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [STEP_COMPLETE]: (evt) => {
      t.assert(typeof evt.timestamp === 'string');
      t.is(evt.timestamp.length, 16);
    },
  });

  const event: any = {
    time: timestamp(),
    jobId: 'job-1',
  };

  t.is(event.time.toString().length, 19);

  const context: any = { channel, state, onFinish: () => {} };
  await handleStepComplete(context, event);
});

test('track leaf dataclip when step has no downstream jobs', async (t) => {
  const plan = createPlan();

  const state = createRunState(plan);
  state.activeJob = 'job-1';
  state.activeStep = 'b';

  const channel = mockChannel({
    [STEP_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 }, next: [] } as any;
  await handleStepComplete({ channel, state } as any, event);

  t.is(state.leafDataclipIds.length, 1);
});

test('track leaf dataclip when step has undefined next', async (t) => {
  const plan = createPlan();

  const state = createRunState(plan);
  state.activeJob = 'job-1';
  state.activeStep = 'b';

  const channel = mockChannel({
    [STEP_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 } } as any;
  await handleStepComplete({ channel, state } as any, event);

  t.is(state.leafDataclipIds.length, 1);
});

test('do not track leaf dataclip when step has downstream jobs', async (t) => {
  const plan = createPlan();

  const state = createRunState(plan);
  state.activeJob = 'job-1';
  state.activeStep = 'b';

  const channel = mockChannel({
    [STEP_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 }, next: ['job-2'] } as any;
  await handleStepComplete({ channel, state } as any, event);

  t.is(state.leafDataclipIds.length, 0);
});

// Multiple leaf nodes: start → job-a (leaf), start → job-b (leaf)
test('accumulate multiple leaf dataclips for branching workflow', async (t) => {
  const plan = createPlan();
  const state = createRunState(plan);

  const channel = mockChannel({
    [STEP_COMPLETE]: () => true,
  });

  // First leaf completes
  state.activeJob = 'job-a';
  state.activeStep = 'step-a';
  await handleStepComplete(
    { channel, state } as any,
    { state: { a: true }, next: [] } as any
  );

  // Second leaf completes
  state.activeJob = 'job-b';
  state.activeStep = 'step-b';
  await handleStepComplete(
    { channel, state } as any,
    { state: { b: true }, next: [] } as any
  );

  t.is(state.leafDataclipIds.length, 2);
  // Each leaf gets a distinct dataclip id
  t.not(state.leafDataclipIds[0], state.leafDataclipIds[1]);
});

// Single leaf reached by two paths: start → a → x, start → b → x
// x executes twice, both times with no downstream
test('accumulate two leaf dataclips when same node reached by two paths', async (t) => {
  const plan = createPlan();
  const state = createRunState(plan);

  const channel = mockChannel({
    [STEP_COMPLETE]: () => true,
  });

  // x completes first time (via path a)
  state.activeJob = 'job-x';
  state.activeStep = 'step-x';
  await handleStepComplete(
    { channel, state } as any,
    { state: { from: 'a' }, next: [] } as any
  );

  // x completes second time (via path b)
  state.activeJob = 'job-x';
  state.activeStep = 'step-x-1';
  await handleStepComplete(
    { channel, state } as any,
    { state: { from: 'b' }, next: [] } as any
  );

  t.is(state.leafDataclipIds.length, 2);
  t.not(state.leafDataclipIds[0], state.leafDataclipIds[1]);
});
