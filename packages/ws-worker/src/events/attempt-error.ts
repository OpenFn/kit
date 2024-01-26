import { calculateJobExitReason } from '../api/reasons';

import type { WorkflowErrorPayload } from '@openfn/engine-multi';

import { ATTEMPT_COMPLETE, AttemptCompletePayload } from '../events';
import { sendEvent, Context, onJobError } from '../api/execute';
import logFinalReason from '../util/log-final-reason';

export default async function onAttemptError(
  context: Context,
  event: WorkflowErrorPayload
) {
  const { state, channel, logger, onFinish } = context;

  try {
    // Ok, let's try that, let's just generate a reason from the event
    const reason = calculateJobExitReason('', { data: {} }, event);
    // If there's a job still running, make sure it gets marked complete
    if (state.activeJob) {
      await onJobError(context, { error: event });
    }

    await logFinalReason(context, reason);

    await sendEvent<AttemptCompletePayload>(channel, ATTEMPT_COMPLETE, {
      final_dataclip_id: state.lastDataclipId!,
      ...reason,
    });

    onFinish({ reason });
  } catch (e: any) {
    logger.error('ERROR in workflow-error handler:', e.message);
    logger.error(e);

    onFinish({});
  }
}
