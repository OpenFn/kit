import crypto from 'node:crypto';
import type { StepCompletePayload } from '@openfn/lexicon/lightning';
import type { JobCompletePayload } from '@openfn/engine-multi';
import { timestamp } from '@openfn/logger';

import { STEP_COMPLETE } from '../events';
import { stringify, timeInMicroseconds } from '../util';
import { calculateJobExitReason } from '../api/reasons';
import { Context } from '../api/execute';
import handleJobLog from './run-log';
import { sendEvent } from '../util/send-event';

export default async function onStepComplete(
  context: Context,
  event: JobCompletePayload,
  // TODO this isn't terribly graceful, but accept an error for crashes
  error?: any
) {
  const { state, options } = context;
  const dataclipId = crypto.randomUUID();

  const step_id = state.activeStep as string;
  const job_id = state.activeJob as string;

  if (!step_id) {
    // Runs are lost in production now because sometimes the step-complete
    // event gets triggered twice. In this case, the second one does not
    // have an activeStep on the state object, so will send with
    // step_id null. And lightning will complain (rightly!) and refuse
    // to listen to subsequent events on the run (wrongly!)
    // This is hard to diagnose in the wild so as a temporary measure,
    // we're going to abort with a strong warning
    context.logger?.warn(
      `DUPLICATE_EVENT_ERROR: Run ${context.id} received two step:complete events for the same step. The second event has been suppressed to prevent a lost run.`
    );
    return;
  }

  if (!state.dataclips) {
    state.dataclips = {};
  }
  const outputState = event.state || {};

  state.dataclips[dataclipId] = event.state;

  delete state.activeStep;
  delete state.activeJob;

  // Track leaf dataclips (steps with no downstream jobs)
  if (!event.next?.length) {
    state.leafDataclipIds.push(dataclipId);
  }

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
    // toPrecision (not toFixed) so small dataclips don't round to "0.00" -
    // this needs to read sensibly from a few KB up to the ~10mb redaction
    // limit, not just near the limit
    dataclip_size_mb: event.payloadSize_b
      ? (event.payloadSize_b / (1024 * 1024)).toPrecision(3)
      : undefined,
  } as StepCompletePayload;

  // Feed through the webhook response if it's on state
  // We do this on the event so that Lightning
  // doesn't have the parse the dataclip
  // (which may not be sent in zero persistence mode!)
  if (outputState.webhookResponse) {
    evt.webhook_response = outputState.webhookResponse;
  }

  if (event.redacted) {
    state.withheldDataclips[dataclipId] = true;
    evt.output_dataclip_error = 'DATACLIP_TOO_LARGE';
    const time = (timestamp() - BigInt(10e6)).toString();
    // If the dataclip is too big, return the step without it
    // (the workflow will carry on internally)
    await handleJobLog(context, [
      {
        time,
        message: [
          'Dataclip exceeds payload limit: output will not be sent back to the app.',
        ],
        level: 'info',
        name: 'R/T',
      },
    ]);
  } else {
    evt.output_dataclip_id = dataclipId;
    // Write the dataclip if it's not too big
    if (!options || options.outputDataclips !== false) {
      // For back compatibility, stringify the the state object before sending
      // Note that this causes payloads to bloat
      // In a major version soon, we should remove the option and never stringify
      evt.output_dataclip = options?.noStringifyState
        ? outputState
        : stringify(outputState);
    }
  }

  const reason = calculateJobExitReason(job_id, event.state, error);
  state.reasons[job_id] = reason;

  Object.assign(evt, reason);

  const { output_dataclip, ...eventWithoutDataclip } = evt;
  context.logger?.debug(
    `${context.id} step-complete (without dataclip): ${JSON.stringify(
      eventWithoutDataclip
    )}`
  );

  context.logger?.debug(
    `${context.id} step-complete payload is ${evt.dataclip_size_mb}mb`
  );

  return sendEvent<StepCompletePayload>(context, STEP_COMPLETE, evt, {
    // Raw bytes, not the formatted evt.dataclip_size_mb string - kept out of
    // the Lightning-bound payload, only surfaced if this push errors or times out
    sentryExtras: { payloadSize_b: event.payloadSize_b },
  });
}
