import { timestamp } from '@openfn/logger';
import type { WorkflowCompletePayload } from '@openfn/engine-multi';

import { ATTEMPT_COMPLETE, AttemptCompletePayload } from '../events';
import { calculateAttemptExitReason } from '../api/reasons';
import { sendEvent, Context, onJobLog } from '../api/execute';

export default async function onWorkflowComplete(
  context: Context,
  _event: WorkflowCompletePayload
) {
  const { state, channel, onFinish } = context;

  // TODO I dont think the attempt final dataclip IS the last job dataclip
  // Especially not in parallelisation
  const result = state.dataclips[state.lastDataclipId!];
  const reason = calculateAttemptExitReason(state);

  const time = (timestamp() - BigInt(10e6)).toString();

  let message = `Run complete with status: ${reason.reason}`;
  if (reason.reason !== 'success') {
    message += `\n${reason.error_type}: ${reason.error_message || 'unknown'}`;
  }

  await onJobLog(context, {
    time,
    message: [message],
    level: 'info',
    name: 'R/T',
  });

  await sendEvent<AttemptCompletePayload>(channel, ATTEMPT_COMPLETE, {
    final_dataclip_id: state.lastDataclipId!,
    ...reason,
  });

  onFinish({ reason, state: result });
}
