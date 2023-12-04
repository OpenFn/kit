import crypto from 'node:crypto';

import { RUN_COMPLETE, RunCompletePayload } from '../events';
import { stringify } from '../util';
import { calculateJobExitReason } from '../api/reasons';
import { sendEvent, Context } from '../api/execute';

import type { JobCompletePayload } from '@openfn/engine-multi';

export default function onRunComplete(
  { channel, state }: Context,
  event: JobCompletePayload,
  // TODO this isn't terribly graceful, but accept an error for crashes
  error?: any
) {
  const dataclipId = crypto.randomUUID();

  const run_id = state.activeRun as string;
  const job_id = state.activeJob as string;

  if (!state.dataclips) {
    state.dataclips = {};
  }
  state.dataclips[dataclipId] = event.state;

  delete state.activeRun;
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
    run_id,
    job_id,
    output_dataclip_id: dataclipId,
    output_dataclip: stringify(event.state),

    reason,
    error_message,
    error_type,

    mem: event.mem,
    duration: event.duration,
    thread_id: event.threadId,
  };
  return sendEvent<RunCompletePayload>(channel, RUN_COMPLETE, evt);
}
