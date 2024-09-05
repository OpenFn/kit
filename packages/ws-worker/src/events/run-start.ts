import type { RunStartPayload } from '@openfn/lexicon/lightning';
import { timestamp } from '@openfn/logger';
import type { WorkflowStartPayload } from '@openfn/engine-multi';

import { RUN_START } from '../events';
import { sendEvent, Context, onJobLog } from '../api/execute';
import calculateVersionString from '../util/versions';

import pkg from '../../package.json' assert { type: 'json' };
import { timeInMicroseconds } from '../util';

export default async function onRunStart(
  context: Context,
  event: WorkflowStartPayload
) {
  const { channel, state, options = {} } = context;
  // Cheat on the timestamp time to make sure this is the first thing in the log
  const time = (timestamp() - BigInt(10e6)).toString();

  // Send the log with its own little state object
  // to preserve the run id
  // Otherwise, by the time the log sends,
  // the active step could have changed
  // TODO if I fix ordering I think I can kill this
  const versionLogContext = {
    ...context,
    state: {
      ...state,
      activeStep: state.activeStep,
    },
  };

  const versions = {
    worker: pkg.version,
    ...event.versions,
  };

  await sendEvent<RunStartPayload>(channel, RUN_START, {
    versions,
    /// use the engine time in run start
    timestamp: timeInMicroseconds(event.time),
  });

  if ('payloadLimitMb' in options) {
    await onJobLog(versionLogContext, {
      // use the fake time in the log
      time,
      message: [`Payload limit: ${options.payloadLimitMb}mb`],
      level: 'info',
      name: 'RTE',
    });
  }

  const versionMessage = calculateVersionString(versions);

  await onJobLog(versionLogContext, {
    time,
    message: [versionMessage],
    level: 'info',
    name: 'VER',
  });
}
