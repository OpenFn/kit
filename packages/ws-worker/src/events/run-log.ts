import type {
  RunLogPayload,
  RunLogLine,
  LegacyRunLogPayload,
} from '@openfn/lexicon/lightning';
import type { WorkerLogPayload } from '@openfn/engine-multi';

import { RUN_LOG } from '../events';
import { Context } from '../api/execute';
import { timeInMicroseconds } from '../util';
import { sendEvent } from '../util/send-event';

export default async function onRunLog(
  context: Context,
  events: Omit<WorkerLogPayload, 'workflowId'>[]
) {
  // Little hack for non-batch mode
  if (!Array.isArray(events)) {
    events = [events];
  }

  const { state, options } = context;
  const { batchLogs } = options ?? {};

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

  if (batchLogs) {
    const payload: RunLogPayload = {
      run_id: `${state.plan.id}`,
      logs,
    };
    return sendEvent<RunLogPayload>(context, RUN_LOG, payload);
  } else {
    return new Promise<void>(async (resolve) => {
      for (const log of logs) {
        const payload = {
          run_id: `${state.plan.id}`,
          ...log,
        } as LegacyRunLogPayload;
        await sendEvent<LegacyRunLogPayload>(context, RUN_LOG, payload);
      }
      resolve();
    });
  }
}
