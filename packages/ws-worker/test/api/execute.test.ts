import test from 'ava';
import { createMockLogger } from '@openfn/logger';
import type { ExecutionPlan } from '@openfn/lexicon';

import {
  STEP_START,
  STEP_COMPLETE,
  RUN_LOG,
  RUN_START,
  RUN_COMPLETE,
  GET_CREDENTIAL,
  GET_DATACLIP,
} from '../../src/events';
import {
  onJobLog,
  execute,
  loadDataclip,
  loadCredential,
  sendEvent,
  onJobError,
} from '../../src/api/execute';
import createMockRTE from '../../src/mock/runtime-engine';
import { mockChannel } from '../../src/mock/sockets';
import { stringify, createRunState } from '../../src/util';

import type { RunState, JSONLog } from '../../src/types';

const enc = new TextEncoder();

const toArrayBuffer = (obj: any) => enc.encode(stringify(obj));

const noop = () => true;

const mockEventHandlers = {
  [RUN_START]: noop,
  [STEP_START]: noop,
  [RUN_LOG]: noop,
  [STEP_COMPLETE]: noop,
  [RUN_COMPLETE]: noop,
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
    throw: () => {
      throw new Error('err');
    },
  });

  await t.throwsAsync(() => sendEvent(channel, 'throw', 22), {
    message: 'err',
  });
});

test('jobLog should should send a log event outside a run', async (t) => {
  const plan = { id: 'run-1' };

  const log: JSONLog = {
    name: 'R/T',
    level: 'info',
    time: getBigIntTimestamp(),
    message: JSON.stringify(['ping']),
  };

  // The logger should print in nanoseconds (19 digits)
  t.is(log.time.length, 19);

  const result = {
    run_id: plan.id,
    message: JSON.parse(log.message),
    // Conveniently this won't have rounding errors because the last
    // 3 digits are always 000, because of how we generate the stamp above
    timestamp: log.time.substring(0, 16),
    level: log.level,
    source: log.name,
  };

  const state = {
    plan,
    // No active run
  } as RunState;

  const channel = mockChannel({
    [RUN_LOG]: (evt) => {
      t.deepEqual(evt, result);
    },
  });

  await onJobLog({ channel, state } as any, log);
});

test('jobLog should should send a log event inside a run', async (t) => {
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

  const channel = mockChannel({
    [RUN_LOG]: (evt) => {
      t.truthy(evt.step_id);
      t.deepEqual(evt.message, JSON.parse(log.message));
      t.is(evt.level, log.level);
      t.is(evt.source, log.name);
      t.is(evt.timestamp, log.time.substring(0, 16));
    },
  });

  await onJobLog({ channel, state } as any, log);
});

test('jobError should trigger step:complete with a reason', async (t) => {
  let stepCompleteEvent: any;

  const state = createRunState({ id: 'run-23' } as ExecutionPlan);
  state.activeJob = 'job-1';
  state.activeStep = 'b';

  const channel = mockChannel({
    [STEP_COMPLETE]: (evt) => {
      stepCompleteEvent = evt;
      return true;
    },
  });

  const exitState = { x: 1 };
  const event = {
    error: { message: 'nope', severity: 'kill', type: 'TEST' },
    state: exitState,
  };
  await onJobError({ channel, state } as any, event);

  t.is(stepCompleteEvent.reason, 'kill');
  t.is(stepCompleteEvent.error_message, 'nope');
  t.is(stepCompleteEvent.error_type, 'TEST');
  t.deepEqual(stepCompleteEvent.output_dataclip, JSON.stringify(exitState));
});

test('jobError should trigger step:complete with a reason and default state', async (t) => {
  let stepCompleteEvent: any;

  const state = createRunState({ id: 'run-23' } as ExecutionPlan);

  const channel = mockChannel({
    [STEP_COMPLETE]: (evt) => {
      stepCompleteEvent = evt;
      return true;
    },
  });

  const event = {
    error: { message: 'nope', severity: 'kill', type: 'TEST' },
  };
  await onJobError({ channel, state } as any, event);

  t.deepEqual(stepCompleteEvent.output_dataclip, '{}');
});

// test('workflowComplete should send an run:complete event', async (t) => {
//   const result = { answer: 42 };

//   const state = {
//     reasons: {},
//     dataclips: {
//       x: result,
//     },
//     lastDataclipId: 'x',
//   };

//   const channel = mockChannel({
//     [RUN_COMPLETE]: (evt) => {
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
//     [RUN_COMPLETE]: () => true,
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
    workflow: {
      steps: [
        {
          expression: 'fn(() => ({ done: true }))',
        },
      ],
    },
  } as ExecutionPlan;

  const options = {};
  const input = {};

  return new Promise((done) => {
    execute(channel, engine, logger, plan, input, options, (result) => {
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
    workflow: {
      steps: [
        {
          expression: 'fn(() => ({ done: true }))',
        },
      ],
    },
  } as ExecutionPlan;

  const options = {};
  const input = {};

  return new Promise((done) => {
    const context = execute(
      channel,
      engine,
      logger,
      plan,
      input,
      options,
      () => {
        done();
      }
    );
    t.truthy(context.state);
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
    workflow: {
      steps: [
        {
          configuration: 'abc',
          expression: 'fn(() => ({ done: true }))',
        },
      ],
    },
  } as ExecutionPlan;

  const options = {};
  const input = {};

  return new Promise((done) => {
    execute(channel, engine, logger, plan, input, options, () => {
      t.true(didCallCredentials);
      done();
    });
  });
});

test('execute should lazy-load initial state', async (t) => {
  const logger = createMockLogger();
  let didLoadState = false;

  const channel = mockChannel({
    ...mockEventHandlers,
    [GET_DATACLIP]: (id) => {
      console.log('> GET DATACLIP');
      t.truthy(id);
      didLoadState = true;
      return toArrayBuffer({});
    },
  });
  const engine = await createMockRTE();

  const plan = {
    id: 'a',
    workflow: {
      steps: [
        {
          expression: 'fn(() => ({ done: true }))',
        },
      ],
    },
    options: {},
  } as ExecutionPlan;

  const options = {};
  const input = 'abc';

  return new Promise((done) => {
    execute(channel, engine, logger, plan, input, options, () => {
      t.true(didLoadState);
      done();
    });
  });
});

test('execute should call all events on the socket', async (t) => {
  const logger = createMockLogger();
  const engine = await createMockRTE();

  const events: Record<string, any> = {};

  const toEventMap = (obj: any, evt: string) => {
    obj[evt] = (e: any) => {
      events[evt] = e || true;
    };
    return obj;
  };

  const allEvents = [
    // Note that these are listed in order but order is not tested
    GET_CREDENTIAL,
    // GET_DATACLIP, // TODO not really implemented properly yet
    RUN_START,
    STEP_START,
    RUN_LOG,
    STEP_COMPLETE,
    RUN_COMPLETE,
  ];

  const channel = mockChannel(allEvents.reduce(toEventMap, {}));

  const plan = {
    id: 'run-1',
    workflow: {
      steps: [
        {
          id: 'trigger',
          configuration: 'a',
          adaptor: '@openfn/language-common@1.0.0',
          expression: 'fn(() => console.log("x"))',
        },
      ],
    },
  } as ExecutionPlan;

  const options = {};
  const input = {};

  return new Promise((done) => {
    execute(channel, engine, logger, plan, input, options, () => {
      // Check that events were passed to the socket
      // This is deliberately crude
      t.assert(allEvents.every((e) => events[e]));
      done();
    });
  });
});
