import type { WorkflowCompletePayload } from '@openfn/engine-multi';
import type { RunCompletePayload } from '@openfn/lexicon/lightning';

import { RUN_COMPLETE } from '../events';
import { calculateRunExitReason } from '../api/reasons';
import { Context } from '../api/execute';
import logFinalReason from '../util/log-final-reason';
import { timeInMicroseconds } from '../util';
import { sendEvent } from '../util/send-event';

const isEmptyState = (obj: any) => {
  if (
    typeof obj === 'string' ||
    typeof obj === 'number' ||
    typeof obj === 'boolean' ||
    obj === null
  ) {
    return false;
  }

  if (typeof obj === 'undefined') {
    // ignore undefined
    return true;
  }

  try {
    if (Object.keys(obj).length == 0) {
      return true;
    }
    if (
      Object.keys(obj).length == 1 &&
      'data' in obj &&
      !Object.keys(obj.data).length
    ) {
      return true;
    }
  } catch (e) {
    // do nothing
  }
  return false;
};

export default async function onWorkflowComplete(
  context: Context,
  event: WorkflowCompletePayload
) {
  const { state, onFinish, logger } = context;

  const isSingleLeaf =
    state.leafDataclipIds.length === 1 &&
    !state.withheldDataclips[state.leafDataclipIds[0]];

  const result = event.state;

  // remove any empty leaf nodes from state
  // This fixes recursive state growth in cron jobs https://github.com/OpenFn/kit/issues/1367
  if (!isSingleLeaf) {
    for (const key in result) {
      if (isEmptyState(result[key])) {
        delete result[key];
      }
    }
  }

  const reason = calculateRunExitReason(state);
  await logFinalReason(context, reason);

  const payload: RunCompletePayload = {
    timestamp: timeInMicroseconds(event.time),
    final_state: result,
    ...reason,
  };

  if (isSingleLeaf) {
    payload.final_dataclip_id = state.leafDataclipIds[0];
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
