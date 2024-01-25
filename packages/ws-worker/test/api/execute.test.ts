import test from 'ava';
import { JSONLog, createMockLogger } from '@openfn/logger';

import {
  RUN_START,
  RUN_COMPLETE,
  ATTEMPT_LOG,
  ATTEMPT_START,
  ATTEMPT_COMPLETE,
  GET_CREDENTIAL,
  GET_DATACLIP,
} from '../../src/events';
import {
  onJobLog,
  execute,
  onWorkflowStart,
  onWorkflowError,
  loadDataclip,
  loadCredential,
  sendEvent,
  onJobError,
} from '../../src/api/execute';
import createMockRTE from '../../src/mock/runtime-engine';
import { mockChannel } from '../../src/mock/sockets';
import { stringify, createAttemptState } from '../../src/util';

import type { ExecutionPlan } from '@openfn/runtime';
import type { Attempt, AttemptState } from '../../src/types';

const enc = new TextEncoder();

const toArrayBuffer = (obj: any) => enc.encode(stringify(obj));

const noop = () => true;

const mockEventHandlers = {
  [ATTEMPT_START]: noop,
  [RUN_START]: noop,
  [ATTEMPT_LOG]: noop,
  [RUN_COMPLETE]: noop,
  [ATTEMPT_COMPLETE]: noop,
};

// This is a nonsense timestamp but it's fine for the test (and easy to convert)
const getBigIntTimestamp = () => (BigInt(Date.now()) * BigInt(1e6)).toString();

test('send event should resolve when the event is acknowledged', async (t) => {
  const channel = mockChannel({
    echo: (x) => x,
  });

  const result = await sendEvent(channel, 'echo', 22);
  t.is(result, 22);
});

test('send event should throw if an event errors', async (t) => {
  const channel = mockChannel({
    throw: (x) => {
      throw new Error('err');
    },
  });

  await t.throwsAsync(() => sendEvent(channel, 'throw', 22), {
    message: 'err',
  });
});

test('jobLog should should send a log event outside a run', async (t) => {
  const plan = { id: 'attempt-1' };

  const log: JSONLog = {
    name: 'R/T',
    level: 'info',
    time: getBigIntTimestamp(),
    message: ['ping'],
  };

  // The logger should print in nanoseconds (19 digits)
  t.is(log.time.length, 19);

  const result = {
    attempt_id: plan.id,
    message: log.message,
    // Conveniently this won't have rounding errors because the last
    // 3 digits are always 000, because of how we generate the stamp above
    timestamp: log.time.substring(0, 16),
    level: log.level,
    source: log.name,
  };

  const state = {
    plan,
    // No active run
  } as AttemptState;

  const channel = mockChannel({
    [ATTEMPT_LOG]: (evt) => {
      t.deepEqual(evt, result);
    },
  });

  await onJobLog({ channel, state }, log);
});

test('jobLog should should send a log event inside a run', async (t) => {
  const plan = { id: 'attempt-1' };
  const jobId = 'job-1';

  const log: JSONLog = {
    name: 'R/T',
    level: 'info',
    time: getBigIntTimestamp(),
    message: ['ping'],
  };

  // The logger should print in nanoseconds (19 digits)
  t.is(log.time.length, 19);

  const state = {
    plan,
    activeJob: jobId,
    activeRun: 'b',
  } as AttemptState;

  const channel = mockChannel({
    [ATTEMPT_LOG]: (evt) => {
      t.truthy(evt.run_id);
      t.deepEqual(evt.message, log.message);
      t.is(evt.level, log.level);
      t.is(evt.source, log.name);
      t.is(evt.timestamp, log.time.substring(0, 16));
    },
  });

  await onJobLog({ channel, state }, log);
});

test('jobError should trigger run:complete with a reason', async (t) => {
  let runCompleteEvent;

  const state = createAttemptState({ id: 'attempt-23' } as Attempt);
  state.activeJob = 'job-1';
  state.activeRun = 'b';

  const channel = mockChannel({
    [RUN_COMPLETE]: (evt) => {
      runCompleteEvent = evt;
      return true;
    },
  });

  const exitState = { x: 1 };
  const event = {
    error: { message: 'nope', severity: 'kill', type: 'TEST' },
    state: exitState,
  };
  await onJobError({ channel, state }, event);

  t.is(runCompleteEvent.reason, 'kill');
  t.is(runCompleteEvent.error_message, 'nope');
  t.is(runCompleteEvent.error_type, 'TEST');
  t.deepEqual(runCompleteEvent.output_dataclip, JSON.stringify(exitState));
});

test('jobError should trigger run:complete with a reason and default state', async (t) => {
  let runCompleteEvent;

  const state = createAttemptState({ id: 'attempt-23' } as Attempt);

  const channel = mockChannel({
    [RUN_COMPLETE]: (evt) => {
      runCompleteEvent = evt;
      return true;
    },
  });

  const event = {
    error: { message: 'nope', severity: 'kill', type: 'TEST' },
  };
  await onJobError({ channel, state }, event);

  t.deepEqual(runCompleteEvent.output_dataclip, '{}');
});

test('workflowStart should send an empty attempt:start event', async (t) => {
  const channel = mockChannel({
    [ATTEMPT_START]: () => {
      t.pass();
    },
  });

  await onWorkflowStart({ channel });
});

// test('workflowComplete should send an attempt:complete event', async (t) => {
//   const result = { answer: 42 };

//   const state = {
//     reasons: {},
//     dataclips: {
//       x: result,
//     },
//     lastDataclipId: 'x',
//   };

//   const channel = mockChannel({
//     [ATTEMPT_COMPLETE]: (evt) => {
//       t.deepEqual(evt.final_dataclip_id, 'x');
//     },
//   });

//   const event = {};

//   const context = { channel, state, onFinish: () => {} };
//   await onWorkflowComplete(context, event);
// });

// test('workflowComplete should call onFinish with final dataclip', async (t) => {
//   const result = { answer: 42 };

//   const state = {
//     reasons: {},
//     dataclips: {
//       x: result,
//     },
//     lastDataclipId: 'x',
//   };

//   const channel = mockChannel({
//     [ATTEMPT_COMPLETE]: () => true,
//   });

//   const context = {
//     channel,
//     state,
//     onFinish: ({ state: finalState }) => {
//       t.deepEqual(result, finalState);
//     },
//   };

//   const event = { state: result };

//   await onWorkflowComplete(context, event);
// });

test('workflowError should trigger runComplete with a reason', async (t) => {
  const jobId = 'job-1';

  const state = {
    reasons: {},
    dataclips: {},
    lastDataclipId: 'x',
    activeJob: jobId,
    activeRun: 'b',
    errors: {},
  };

  const channel = mockChannel({
    [RUN_COMPLETE]: (evt) => {
      t.is(evt.reason, 'crash');
      t.is(evt.error_message, 'it crashed');
      return true;
    },
    [ATTEMPT_COMPLETE]: () => true,
  });

  const event = {
    severity: 'crash',
    type: 'Err',
    message: 'it crashed',
  };

  const context = { channel, state, onFinish: () => {} };

  await onWorkflowError(context, event);
});

test('workflow error should send reason to onFinish', async (t) => {
  const jobId = 'job-1';

  const state = {
    reasons: {},
    dataclips: {},
    lastDataclipId: 'x',
    activeJob: jobId,
    activeRun: 'b',
    errors: {},
  };

  const channel = mockChannel({
    [RUN_COMPLETE]: (evt) => true,
    [ATTEMPT_COMPLETE]: () => true,
  });

  const event = {
    error: {
      severity: 'crash',
      type: 'Err',
      message: 'it crashed',
    },
    state: {},
  };

  const context = {
    channel,
    state,
    onFinish: (evt) => {
      t.is(evt.reason.reason, 'crash');
    },
  };

  await onWorkflowError(context, event);
});

test('workflowError should not call job complete if the job is not active', async (t) => {
  const state = {
    reasons: {},
    dataclips: {},
    lastDataclipId: 'x',
    activeJob: undefined,
    activeRun: undefined,
    errors: {},
  };

  const channel = mockChannel({
    [RUN_COMPLETE]: (evt) => {
      t.fail('should not call!');
      return true;
    },
    [ATTEMPT_COMPLETE]: () => true,
  });

  const event = {
    error: {
      severity: 'crash',
      type: 'Err',
      message: 'it crashed',
    },
    state: {},
  };

  const context = {
    channel,
    state,
    onFinish: () => {
      t.pass();
    },
  };

  await onWorkflowError(context, event);
});

// TODO what if an error?
test('loadDataclip should fetch a dataclip', async (t) => {
  const channel = mockChannel({
    [GET_DATACLIP]: ({ id }) => {
      t.is(id, 'xyz');
      return toArrayBuffer({ data: {} });
    },
  });

  const state = await loadDataclip(channel, 'xyz');
  t.deepEqual(state, { data: {} });
});

// TODO what if an error?
test('loadCredential should fetch a credential', async (t) => {
  const channel = mockChannel({
    [GET_CREDENTIAL]: ({ id }) => {
      t.is(id, 'jfk');
      return { apiKey: 'abc' };
    },
  });

  const state = await loadCredential(channel, 'jfk');
  t.deepEqual(state, { apiKey: 'abc' });
});

test('execute should pass the final result to onFinish', async (t) => {
  const channel = mockChannel(mockEventHandlers);
  const engine = await createMockRTE();
  const logger = createMockLogger();

  const plan = {
    id: 'a',
    jobs: [
      {
        expression: 'fn(() => ({ done: true }))',
      },
    ],
  };

  const options = {};

  return new Promise((done) => {
    execute(channel, engine, logger, plan, options, (result) => {
      t.deepEqual(result.state, { done: true });
      done();
    });
  });
});

test('execute should return a context object', async (t) => {
  const channel = mockChannel(mockEventHandlers);
  const engine = await createMockRTE();
  const logger = createMockLogger();

  const plan = {
    id: 'a',
    jobs: [
      {
        expression: 'fn(() => ({ done: true }))',
      },
    ],
  };

  const options = {};

  return new Promise((done) => {
    const context = execute(
      channel,
      engine,
      logger,
      plan,
      options,
      (result) => {
        done();
      }
    );
    t.truthy(context.state);
    t.deepEqual(context.state.options, options);
    t.deepEqual(context.channel, channel);
    t.deepEqual(context.logger, logger);
  });
});

// TODO this is more of an engine test really, but worth having I suppose
test('execute should lazy-load a credential', async (t) => {
  const logger = createMockLogger();
  let didCallCredentials = false;

  const channel = mockChannel({
    ...mockEventHandlers,
    [GET_CREDENTIAL]: (id) => {
      t.truthy(id);
      didCallCredentials = true;
      return {};
    },
  });
  const engine = await createMockRTE();

  const plan = {
    id: 'a',
    jobs: [
      {
        configuration: 'abc',
        expression: 'fn(() => ({ done: true }))',
      },
    ],
  };

  const options = {};

  return new Promise((done) => {
    execute(channel, engine, logger, plan, options, (result) => {
      t.true(didCallCredentials);
      done();
    });
  });
});

test('execute should lazy-load initial state', async (t) => {
  const logger = createMockLogger();
  let didCallState = false;

  const channel = mockChannel({
    ...mockEventHandlers,
    [GET_DATACLIP]: (id) => {
      t.truthy(id);
      didCallState = true;
      return toArrayBuffer({});
    },
  });
  const engine = await createMockRTE();

  const plan: Partial<ExecutionPlan> = {
    id: 'a',
    // @ts-ignore
    initialState: 'abc',
    jobs: [
      {
        expression: 'fn(() => ({ done: true }))',
      },
    ],
  };

  const options = {};

  return new Promise((done) => {
    execute(channel, engine, logger, plan, options, (result) => {
      t.true(didCallState);
      done();
    });
  });
});

test('execute should call all events on the socket', async (t) => {
  const logger = createMockLogger();
  const engine = await createMockRTE();

  const events = {};

  const toEventMap = (obj, evt: string) => {
    obj[evt] = (e) => {
      events[evt] = e || true;
    };
    return obj;
  };

  const allEvents = [
    // Note that these are listed in order but order is not tested
    GET_CREDENTIAL,
    // GET_DATACLIP, // TODO not really implemented properly yet
    ATTEMPT_START,
    RUN_START,
    ATTEMPT_LOG,
    RUN_COMPLETE,
    ATTEMPT_COMPLETE,
  ];

  const channel = mockChannel(allEvents.reduce(toEventMap, {}));

  const plan = {
    id: 'attempt-1',
    jobs: [
      {
        id: 'trigger',
        configuration: 'a',
        adaptor: '@openfn/language-common@1.0.0',
        expression: 'fn(() => console.log("x"))',
      },
    ],
  };

  const options = {};

  return new Promise((done) => {
    execute(channel, engine, logger, plan, options, (result) => {
      // Check that events were passed to the socket
      // This is deliberately crude
      t.assert(allEvents.every((e) => events[e]));
      done();
    });
  });
});
