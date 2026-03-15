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

  const result = event.state;

  const reason = calculateRunExitReason(state);
  await logFinalReason(context, reason);

  const isSingleLeaf =
    state.leafDataclipIds.length === 1 &&
    !state.withheldDataclips[state.leafDataclipIds[0]];

  const payload: RunCompletePayload = {
    timestamp: timeInMicroseconds(event.time),
    ...reason,
  };

  if (isSingleLeaf) {
    payload.final_dataclip_id = state.leafDataclipIds[0];
  } else {
    payload.final_state = result;
  }

  try {
    await sendEvent<RunCompletePayload>(context, RUN_COMPLETE, payload);
  } catch (e) {
    logger.error(
      `${state.plan.id} failed to send ${RUN_COMPLETE} event. This run will be lost!`
    );
    logger.error(e);
  }

  onFinish({ reason, state: result });
}
