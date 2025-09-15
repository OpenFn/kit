import type { WorkflowCompletePayload } from '@openfn/engine-multi';
import type { RunCompletePayload } from '@openfn/lexicon/lightning';

import { RUN_COMPLETE } from '../events';
import { calculateRunExitReason } from '../api/reasons';
import { Context } from '../api/execute';
import logFinalReason from '../util/log-final-reason';
import { timeInMicroseconds } from '../util';
import { sendEvent } from '../util/send-event';

export default async function onWorkflowComplete(
  context: Context,
  event: WorkflowCompletePayload
) {
  const { state, onFinish, logger } = context;

  // TODO I dont think the run final dataclip IS the last job dataclip
  // Especially not in parallelisation
  const result = state.dataclips[state.lastDataclipId!];

  const reason = calculateRunExitReason(state);
  await logFinalReason(context, reason);

  logger.success(`(heap) duration: ${event.duration}ms`);

  try {
    await sendEvent<RunCompletePayload>(context, RUN_COMPLETE, {
      final_dataclip_id: state.lastDataclipId!,
      timestamp: timeInMicroseconds(event.time),
      ...reason,
    });
  } catch (e) {
    logger.error(
      `${state.plan.id} failed to send ${RUN_COMPLETE} event. This run will be lost!`
    );
    logger.error(e);
  }

  onFinish({ reason, state: result });
}
