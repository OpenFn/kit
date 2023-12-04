import crypto from 'node:crypto';
import { JobStartPayload } from '@openfn/engine-multi';

import pkg from '../../package.json' assert { type: 'json' };
import { RUN_START, RunStartPayload } from '../events';
import { sendEvent, Context, onJobLog } from '../api/execute';

export default async function onJobStart(
  context: Context,
  event: JobStartPayload
) {
  const { channel, state } = context;

  // generate a run id and write it to state
  state.activeRun = crypto.randomUUID();
  state.activeJob = event.jobId;

  const input_dataclip_id = state.inputDataclips[event.jobId];

  const versions = {
    worker: pkg.version,
    ...event.versions,
  };

  await sendEvent<RunStartPayload>(channel, RUN_START, {
    run_id: state.activeRun!,
    job_id: state.activeJob!,
    input_dataclip_id,

    versions,
  });

  const versionMessage = 'TODO'; //calculateVersionString(versions);

  return onJobLog(context, {
    // this is a little difficult to simulate
    // Maybe I should use the logger more directly?
    time: Date.now().toString(),
    message: versionMessage,
    level: 'info',
    name: 'VER',
  });
}
