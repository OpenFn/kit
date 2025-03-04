import crypto from 'node:crypto';
import type { StepCompletePayload } from '@openfn/lexicon/lightning';
import type { JobCompletePayload } from '@openfn/engine-multi';
import { timestamp } from '@openfn/logger';

import { STEP_COMPLETE } from '../events';
import { stringify, timeInMicroseconds } from '../util';
import { calculateJobExitReason } from '../api/reasons';
import { sendEvent, onJobLog, Context } from '../api/execute';

export default async function onStepComplete(
  context: Context,
  event: JobCompletePayload,
  // TODO this isn't terribly graceful, but accept an error for crashes
  error?: any
) {
  const { channel, state, options } = context;
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

  // TODO right now, the last job to run will be the result for the run
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

  const evt = {
    step_id,
    job_id,

    mem: event.mem,
    duration: event.duration,
    thread_id: event.threadId,
    timestamp: timeInMicroseconds(event.time),
  } as StepCompletePayload;

  if (event.redacted) {
    state.withheldDataclips[dataclipId] = true;
    evt.output_dataclip_error = 'DATACLIP_TOO_LARGE';
    const time = (timestamp() - BigInt(10e6)).toString();
    // If the dataclip is too big, return the step without it
    // (the workflow will carry on internally)
    await onJobLog(context, {
      time,
      message: [
        'Dataclip too large. This dataclip will not be sent back to lightning.',
      ],
      level: 'info',
      name: 'R/T',
    });
  } else {
    evt.output_dataclip_id = dataclipId;
    if (!options || options.outputDataclips !== false) {
      const payload = stringify(outputState);
      // Write the dataclip if it's not too big
      evt.output_dataclip = payload;
    }
  }

  const reason = calculateJobExitReason(job_id, event.state, error);
  state.reasons[job_id] = reason;

  Object.assign(evt, reason);

  return sendEvent<StepCompletePayload>(channel, STEP_COMPLETE, evt);
}
