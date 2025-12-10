import test from 'ava';

import handleRunLog from '../../src/events/run-log';
import { mockChannel } from '../../src/mock/sockets';
import { RUN_LOG } from '../../src/events';

import type { RunState, JSONLog } from '../../src/types';

// This is a nonsense timestamp but it's fine for the test (and easy to convert)
const getBigIntTimestamp = () => (BigInt(Date.now()) * BigInt(1e6)).toString();

test('should send a log event outside a run', async (t) => {
  const plan = { id: 'run-1' };

  const log: JSONLog = {
    name: 'R/T',
    level: 'info',
    time: getBigIntTimestamp(),
    message: JSON.stringify(['ping']),
  };

  // The logger should print in nanoseconds (19 digits)
  t.is(log.time.length, 19);

  const state = {
    plan,
    // No active run
  } as RunState;

  const options = {
    batchLogs: true,
  };

  const channel = mockChannel({
    [RUN_LOG]: (evt) => {
      t.is(evt.run_id, plan.id);
      t.is(evt.logs.length, 1);
      t.deepEqual(evt.logs[0].message, JSON.parse(log.message));
      // Conveniently this won't have rounding errors because the last
      // 3 digits are always 000, because of how we generate the stamp above
      t.is(evt.logs[0].timestamp, log.time.substring(0, 16));
      t.is(evt.logs[0].level, log.level);
      t.is(evt.logs[0].source, log.name);
    },
  });

  await handleRunLog({ channel, state, options } as any, log);
});

test('should replace the message of redacted logs', async (t) => {
  const plan = { id: 'run-1' };
  const jobId = 'job-1';

  const log: JSONLog = {
    name: 'R/T',
    level: 'info',
    time: getBigIntTimestamp(),
    message: ['<large object>'],
    redacted: true,
  };

  const state = {
    plan,
    activeJob: jobId,
    activeStep: 'b',
  } as RunState;

  const channel = mockChannel({
    [RUN_LOG]: (evt) => {
      t.is(evt.logs.length, 1);
      t.regex(evt.logs[0].message[0], /redacted/i);
    },
  });

  const options = {
    payloadLimitMb: 1,
    batchLogs: true,
  };

  await handleRunLog({ channel, state, options } as any, [log]);
});

test('should send a log event inside a run', async (t) => {
  const plan = { id: 'run-1' };
  const jobId = 'job-1';

  const log: JSONLog = {
    name: 'R/T',
    level: 'info',
    time: getBigIntTimestamp(),
    message: JSON.stringify(['ping']),
  };

  // The logger should print in nanoseconds (19 digits)
  t.is(log.time.length, 19);

  const state = {
    plan,
    activeJob: jobId,
    activeStep: 'b',
  } as RunState;

  const options = {
    batchLogs: true,
  };

  const channel = mockChannel({
    [RUN_LOG]: (evt) => {
      t.is(evt.logs.length, 1);
      t.truthy(evt.logs[0].step_id);
      t.deepEqual(evt.logs[0].message, JSON.parse(log.message));
      t.is(evt.logs[0].level, log.level);
      t.is(evt.logs[0].source, log.name);
      t.is(evt.logs[0].timestamp, log.time.substring(0, 16));
    },
  });

  await handleRunLog({ channel, state, options } as any, [log]);
});

// If batch mode is disabled, logs are sent as a single event
// (no logs array)
// I'm calling this the LegacyRunLogPayload
test('should work with non-batch logging', async (t) => {
  const plan = { id: 'run-1' };

  const log: JSONLog = {
    name: 'R/T',
    level: 'info',
    time: getBigIntTimestamp(),
    message: JSON.stringify(['ping']),
  };

  // The logger should print in nanoseconds (19 digits)
  t.is(log.time.length, 19);

  const state = {
    plan,
    // No active run
  } as RunState;

  const options = {
    batchLogs: false,
  };

  const channel = mockChannel({
    [RUN_LOG]: (evt) => {
      t.is(evt.run_id, plan.id);
      t.deepEqual(evt.message, JSON.parse(log.message));
      // Conveniently this won't have rounding errors because the last
      // 3 digits are always 000, because of how we generate the stamp above
      t.is(evt.timestamp, log.time.substring(0, 16));
      t.is(evt.level, log.level);
      t.is(evt.source, log.name);
    },
  });

  await handleRunLog({ channel, state, options } as any, log);
});
