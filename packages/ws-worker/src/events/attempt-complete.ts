import type { WorkflowCompletePayload } from '@openfn/engine-multi';

import { ATTEMPT_COMPLETE, AttemptCompletePayload } from '../events';
import { calculateAttemptExitReason } from '../api/reasons';
import { sendEvent, Context } from '../api/execute';
import logFinalReason from '../util/log-final-reason';

export default async function onWorkflowComplete(
  context: Context,
  _event: WorkflowCompletePayload
) {
  const { state, channel, onFinish } = context;

  // TODO I dont think the attempt final dataclip IS the last job dataclip
  // Especially not in parallelisation
  const result = state.dataclips[state.lastDataclipId!];

  const reason = calculateAttemptExitReason(state);
  await logFinalReason(context, reason);

  await sendEvent<AttemptCompletePayload>(channel, ATTEMPT_COMPLETE, {
    final_dataclip_id: state.lastDataclipId!,
    ...reason,
  });

  onFinish({ reason, state: result });
}
