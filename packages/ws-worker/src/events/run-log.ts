import type { RunLogPayload, RunLogLine } from '@openfn/lexicon/lightning';
import type { WorkerLogPayload } from '@openfn/engine-multi';

import { RUN_LOG } from '../events';
import { Context } from '../api/execute';
import { timeInMicroseconds } from '../util';
import { sendEvent } from '../util/send-event';

export default function onRunLog(
  context: Context,
  events: Omit<WorkerLogPayload, 'workflowId'>[]
) {
  const { state, options } = context;

  // Convert each event to a RunLogLine
  const logs = events.map((evt) => {
    let message = evt.message as any[];

    if (evt.redacted) {
      message = [
        `(Log message redacted: exceeds ${
          options.logPayloadLimitMb ?? options.payloadLimitMb
        }mb memory limit)`,
      ];
    } else if (typeof evt.message === 'string') {
      message = JSON.parse(evt.message);
    }

    const logLine: RunLogLine = {
      message,
      source: evt.name,
      level: evt.level,
      timestamp: timeInMicroseconds(evt.time as any),
    };

    if (state.activeStep) {
      logLine.step_id = state.activeStep;
    }

    return logLine;
  });

  // lightning-friendly log payload
  const payload: RunLogPayload = {
    run_id: `${state.plan.id}`,
    logs,
  };

  return sendEvent<RunLogPayload>(context, RUN_LOG, payload);
}
