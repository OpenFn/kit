import crypto from 'node:crypto';
import { JobStartPayload } from '@openfn/engine-multi';
import type { StepStartPayload } from '@openfn/lexicon/lightning';

import { STEP_START } from '../events';
import { sendEvent, Context } from '../api/execute';
import { timeInMicroseconds } from '../util';

export default async function onStepStart(
  context: Context,
  event: JobStartPayload
) {
  const { channel, state } = context;

  // generate a run id and write it to state
  state.activeStep = crypto.randomUUID();
  state.activeJob = event.jobId;

  const input_dataclip_id = state.inputDataclips[event.jobId];

  const evt: StepStartPayload = {
    step_id: state.activeStep!,
    job_id: state.activeJob!,
    timestamp: timeInMicroseconds(event.time),
  };
  if (!state.withheldDataclips[input_dataclip_id]) {
    evt.input_dataclip_id = input_dataclip_id;
  }

  await sendEvent<StepStartPayload>(channel, STEP_START, evt);
}
