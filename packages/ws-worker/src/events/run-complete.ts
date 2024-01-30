import type { WorkflowCompletePayload } from '@openfn/engine-multi';

import { RUN_COMPLETE, RunCompletePayload } from '../events';
import { calculateRunExitReason } from '../api/reasons';
import { sendEvent, Context } from '../api/execute';
import logFinalReason from '../util/log-final-reason';

export default async function onWorkflowComplete(
  context: Context,
  _event: WorkflowCompletePayload
) {
  const { state, channel, onFinish } = context;

  // TODO I dont think the run final dataclip IS the last job dataclip
  // Especially not in parallelisation
  const result = state.dataclips[state.lastDataclipId!];

  const reason = calculateRunExitReason(state);
  await logFinalReason(context, reason);

  await sendEvent<RunCompletePayload>(channel, RUN_COMPLETE, {
    final_dataclip_id: state.lastDataclipId!,
    ...reason,
  });

  onFinish({ reason, state: result });
}
