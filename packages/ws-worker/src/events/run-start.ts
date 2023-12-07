import crypto from 'node:crypto';
import { JobStartPayload } from '@openfn/engine-multi';
import { timestamp } from '@openfn/logger';

import pkg from '../../package.json' assert { type: 'json' };
import { RUN_START, RunStartPayload } from '../events';
import { sendEvent, Context, onJobLog } from '../api/execute';
import calculateVersionString from '../util/versions';

export default async function onRunStart(
  context: Context,
  event: JobStartPayload
) {
  // Cheat on the timestamp time to make sure this is the first thing in the log
  // this doesn't work in streaming
  const time = (timestamp() - BigInt(1e6)).toString();

  const { channel, state } = context;

  // generate a run id and write it to state
  state.activeRun = crypto.randomUUID();
  state.activeJob = event.jobId;

  const input_dataclip_id = state.inputDataclips[event.jobId];

  const versions = {
    worker: pkg.version,
    ...event.versions,
  };

  // Send the log with its own little state object
  // to preserve the run id
  // Otherwise, by the time the log sends,
  // the activerun could have changed
  // TODO if I fix ordering I think I can kill this
  const versionLogContext = {
    ...context,
    state: {
      ...state,
      activeRun: state.activeRun,
    },
  };

  await sendEvent<RunStartPayload>(channel, RUN_START, {
    run_id: state.activeRun!,
    job_id: state.activeJob!,
    input_dataclip_id,

    versions,
  });

  const versionMessage = calculateVersionString(versions);

  return await onJobLog(versionLogContext, {
    time,
    message: [versionMessage],
    level: 'info',
    name: 'VER',
  });
}
