import test from 'ava';
import handleStepStart from '../../src/events/step-start';

import { mockChannel } from '../../src/mock/sockets';
import { createRunState } from '../../src/util';
import { RUN_LOG, STEP_START } from '../../src/events';
import { timestamp } from '@openfn/logger';

test('set a step id and active job on state', async (t) => {
  const plan = {
    id: 'run-1',
    workflow: { steps: [{ id: 'job-1' }] },
    options: {},
  };
  const jobId = 'job-1';

  const state = createRunState(plan);

  const channel = mockChannel({
    [STEP_START]: (x) => x,
    [RUN_LOG]: (x) => x,
  });

  const event = { jobId } as any;
  await handleStepStart({ channel, state } as any, event);

  t.is(state.activeJob, jobId);
  t.truthy(state.activeStep);
});

test('send a step:start event', async (t) => {
  const plan = {
    id: 'run-1',
    workflow: {
      steps: [
        { id: 'job-1', expression: '.' },
        { id: 'job-2', expression: '.' },
      ],
    },
    options: {},
  };
  const input = 'abc';
  const jobId = 'job-1';

  const state = createRunState(plan, input);
  state.activeJob = jobId;
  state.activeStep = 'b';

  const channel = mockChannel({
    [STEP_START]: (evt) => {
      t.is(evt.job_id, jobId);
      t.is(evt.input_dataclip_id, input);
      t.truthy(evt.step_id);
      return true;
    },
    [RUN_LOG]: () => true,
  });

  const event = { jobId } as any;
  await handleStepStart({ channel, state } as any, event);
});

test('should include a timestamp', async (t) => {
  const plan = {
    id: 'run-1',
    workflow: {
      steps: [{ id: 'job-1', expression: '.' }],
    },
    options: {},
  };

  const state = createRunState(plan);

  const channel = mockChannel({
    [RUN_LOG]: () => true,
    [STEP_START]: (evt) => {
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
  await handleStepStart(context, event);
});
