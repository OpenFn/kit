import {
  ATTEMPT_LOG,
  AttemptLogPayload,
  RUN_START,
  RunStartPayload,
} from '../events';
import { sendEvent, Context, onJobLog } from '../api/execute';
import { WORKFLOW_LOG } from '@openfn/engine-multi';

export default async function onJobStart(context: Context, event: any) {
  const { channel, state } = context;

  // generate a run id and write it to state
  state.activeRun = crypto.randomUUID();
  state.activeJob = event.jobId;

  const input_dataclip_id = state.inputDataclips[event.jobId];

  const versions = calculateVersions();

  await sendEvent<RunStartPayload>(channel, RUN_START, {
    run_id: state.activeRun!,
    job_id: state.activeJob!,
    input_dataclip_id,

    // first we send versions with run start, as a formal declaration to lightning
    versions,
  });

  const versionMessage = calculateVersionString(versions);

  return onJobLog(context, {
    // this is a little difficult to simulate
    // Maybe I should use the logger more directly?
    time: Date.now().toString(),
    message: versionMessage,
    level: 'info',
    name: 'VER',
  });
}
