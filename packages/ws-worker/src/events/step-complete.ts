import crypto from 'node:crypto';

import { STEP_COMPLETE, StepCompletePayload } from '../events';
import { stringify } from '../util';
import { calculateJobExitReason } from '../api/reasons';
import { sendEvent, Context } from '../api/execute';

import type { JobCompletePayload } from '@openfn/engine-multi';

export default function onStepComplete(
  { channel, state }: Context,
  event: JobCompletePayload,
  // TODO this isn't terribly graceful, but accept an error for crashes
  error?: any
) {
  const dataclipId = crypto.randomUUID();

  const step_id = state.activeStep as string;
  const job_id = state.activeJob as string;

  if (!state.dataclips) {
    state.dataclips = {};
  }
  const outputState = event.state || {};

  state.dataclips[dataclipId] = event.state;

  delete state.activeStep;
  delete state.activeJob;

  // TODO right now, the last job to run will be the result for the attempt
  // this may not stand up in the future
  // I'd feel happer if the runtime could judge what the final result is
  // (taking into account branches and stuff)
  // The problem is that the runtime will return the object, not an id,
  // so we have a bit of a mapping problem
  state.lastDataclipId = dataclipId;

  // Set the input dataclip id for downstream jobs
  event.next?.forEach((nextJobId) => {
    state.inputDataclips[nextJobId] = dataclipId;
  });

  const { reason, error_message, error_type } = calculateJobExitReason(
    job_id,
    event.state,
    error
  );
  state.reasons[job_id] = { reason, error_message, error_type };

  const evt = {
    step_id,
    job_id,
    output_dataclip_id: dataclipId,
    output_dataclip: stringify(outputState),

    reason,
    error_message,
    error_type,

    mem: event.mem,
    duration: event.duration,
    thread_id: event.threadId,
  };
  return sendEvent<StepCompletePayload>(channel, STEP_COMPLETE, evt);
}
