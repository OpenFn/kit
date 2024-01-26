import crypto from 'node:crypto';
import { JobStartPayload } from '@openfn/engine-multi';
import { timestamp } from '@openfn/logger';

import pkg from '../../package.json' assert { type: 'json' };
import { STEP_START, StepStartPayload } from '../events';
import { sendEvent, Context, onJobLog } from '../api/execute';
import calculateVersionString from '../util/versions';

export default async function onStepStart(
  context: Context,
  event: JobStartPayload
) {
  // Cheat on the timestamp time to make sure this is the first thing in the log
  const time = (timestamp() - BigInt(10e6)).toString();

  const { channel, state } = context;

  // generate a run id and write it to state
  state.activeStep = crypto.randomUUID();
  state.activeJob = event.jobId;

  const job = state.plan.jobs.find(({ id }) => id === event.jobId);

  const input_dataclip_id = state.inputDataclips[event.jobId];

  const versions = {
    worker: pkg.version,
    ...event.versions,
  };

  // Send the log with its own little state object
  // to preserve the run id
  // Otherwise, by the time the log sends,
  // the active step could have changed
  // TODO if I fix ordering I think I can kill this
  const versionLogContext = {
    ...context,
    state: {
      ...state,
      activeStep: state.activeStep,
    },
  };

  await sendEvent<StepStartPayload>(channel, STEP_START, {
    step_id: state.activeStep!,
    job_id: state.activeJob!,
    input_dataclip_id,

    versions,
  });

  const versionMessage = calculateVersionString(
    versionLogContext.state.activeStep,
    versions,
    job?.adaptor
  );

  await onJobLog(versionLogContext, {
    time,
    message: [versionMessage],
    level: 'info',
    name: 'VER',
  });
  return;
}
