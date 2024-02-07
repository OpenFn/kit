import type { RunCompletePayload } from '@openfn/lexicon/lightning';
import type { WorkflowErrorPayload } from '@openfn/engine-multi';

import { calculateJobExitReason } from '../api/reasons';
import { RUN_COMPLETE } from '../events';
import { sendEvent, Context, onJobError } from '../api/execute';
import logFinalReason from '../util/log-final-reason';

export default async function onRunError(
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

    await sendEvent<RunCompletePayload>(channel, RUN_COMPLETE, {
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
