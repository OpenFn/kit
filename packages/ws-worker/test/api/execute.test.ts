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
  onJobStart,
  onJobComplete,
  onJobLog,
  execute,
  onWorkflowStart,
  onWorkflowComplete,
  AttemptState,
  loadDataclip,
  loadCredential,
  sendEvent,
  createAttemptState,
} from '../../src/api/execute';
import createMockRTE from '../../src/mock/runtime-engine';
import { mockChannel } from '../../src/mock/sockets';
import { stringify } from '../../src/util';
import { ExecutionPlan } from '@openfn/runtime';

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

test('send event should resolve when the event is acknowledged', async (t) => {
  const channel = mockChannel({
    echo: (x) => x,
  });

  const result = await sendEvent(channel, 'echo', 22);
  t.is(result, 22);
});

test('send event should throw if the event errors', async (t) => {
  const channel = mockChannel({
    echo: (x) => {
      throw new Error('err');
    },
  });

  await t.throwsAsync(() => sendEvent(channel, 'echo', 22), {
    message: 'err',
  });
});

test('jobStart should set a run id and active job on state', async (t) => {
  const plan = { id: 'attempt-1' };
  const jobId = 'job-1';

  const state = {
    plan,
  } as AttemptState;

  const channel = mockChannel({
    [RUN_START]: (x) => x,
  });

  await onJobStart({ channel, state }, { jobId });

  t.is(state.activeJob, jobId);
  t.truthy(state.activeRun);
});

test('jobStart should send a run:start event', async (t) => {
  const plan = { id: 'attempt-1' };
  const jobId = 'job-1';

  const state = createAttemptState(plan);
  state.activeJob = jobId;
  state.activeRun = 'b';
  state.lastDataclipId = 'abc'; // this will be set to initial state by execute

  const channel = mockChannel({
    [RUN_START]: (evt) => {
      t.is(evt.job_id, jobId);
      t.is(evt.input_dataclip_id, state.lastDataclipId);
      t.truthy(evt.run_id);
      return true;
    },
  });

  await onJobStart({ channel, state }, { jobId });
});

test('jobComplete should clear the run id and active job on state', async (t) => {
  const plan = { id: 'attempt-1' };
  const jobId = 'job-1';

  const state = createAttemptState(plan);
  state.activeJob = jobId;
  state.activeRun = 'b';

  const channel = mockChannel({
    [RUN_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 } };
  await onJobComplete({ channel, state }, event);

  t.falsy(state.activeJob);
  t.falsy(state.activeRun);
});

test('jobComplete should save the dataclip to state', async (t) => {
  const plan = { id: 'attempt-1' } as ExecutionPlan;
  const jobId = 'job-1';

  const state = createAttemptState(plan);
  state.activeJob = jobId;
  state.activeRun = 'b';

  const channel = mockChannel({
    [RUN_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 } };
  await onJobComplete({ channel, state }, event);

  t.is(Object.keys(state.dataclips).length, 1);
  const [dataclip] = Object.values(state.dataclips);
  t.deepEqual(dataclip, event.state);
});

test('jobComplete should write a reason to state', async (t) => {
  const plan = { id: 'attempt-1' } as ExecutionPlan;
  const jobId = 'job-1';

  const state = createAttemptState(plan);
  state.activeJob = jobId;
  state.activeRun = 'b';

  t.is(Object.keys(state.reasons).length, 0);

  const channel = mockChannel({
    [RUN_COMPLETE]: () => true,
  });

  const event = { state: { x: 10 } };
  await onJobComplete({ channel, state }, event);

  t.is(Object.keys(state.reasons).length, 1);
  t.deepEqual(state.reasons[jobId], {
    reason: 'success',
    error_type: null,
    message: null,
  });
});

test('jobComplete should generate an exit reason: success', async (t) => {
  const plan = { id: 'attempt-1' } as ExecutionPlan;
  const jobId = 'job-1';

  const state = createAttemptState(plan);
  state.activeJob = jobId;
  state.activeRun = 'b';

  let event;

  const channel = mockChannel({
    [RUN_COMPLETE]: (e) => {
      event = e;
    },
  });

  await onJobComplete({ channel, state }, { state: { x: 10 } });

  t.truthy(event);
  t.is(event.reason, 'success');
  t.is(event.error_type, null);
  t.is(event.message, null);
});

test('jobComplete should send a run:complete event', async (t) => {
  const plan = { id: 'attempt-1' };
  const jobId = 'job-1';
  const result = { x: 10 };

  const state = createAttemptState(plan);
  state.activeJob = jobId;
  state.activeRun = 'b';

  const channel = mockChannel({
    [RUN_COMPLETE]: (evt) => {
      t.is(evt.job_id, jobId);
      t.truthy(evt.run_id);
      t.truthy(evt.output_dataclip_id);
      t.is(evt.output_dataclip, JSON.stringify(result));
    },
  });

  const event = { state: result };
  await onJobComplete({ channel, state }, event);
});

test('jobLog should should send a log event outside a run', async (t) => {
  const plan = { id: 'attempt-1' };

  const log: JSONLog = {
    name: 'R/T',
    level: 'info',
    time: Date.now(),
    message: ['ping'],
  };

  const result = {
    attempt_id: plan.id,
    message: log.message,
    timestamp: log.time,
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
    time: new Date().getTime(),
    message: ['ping'],
  };

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
      t.is(evt.timestamp, log.time);
    },
  });

  await onJobLog({ channel, state }, log);
});

test('workflowStart should send an empty attempt:start event', async (t) => {
  const channel = mockChannel({
    [ATTEMPT_START]: () => {
      t.pass();
    },
  });

  await onWorkflowStart({ channel });
});

test('workflowComplete should send an attempt:complete event', async (t) => {
  const result = { answer: 42 };

  const state = {
    dataclips: {
      x: result,
    },
    lastDataclipId: 'x',
  };

  const channel = mockChannel({
    [ATTEMPT_COMPLETE]: (evt) => {
      t.deepEqual(evt.final_dataclip_id, 'x');
    },
  });

  const event = {};

  const context = { channel, state, onComplete: () => {} };
  await onWorkflowComplete(context, event);
});

test('workflowComplete should call onComplete with final dataclip', async (t) => {
  const result = { answer: 42 };

  const state = {
    dataclips: {
      x: result,
    },
    lastDataclipId: 'x',
  };

  const channel = mockChannel({
    [ATTEMPT_COMPLETE]: () => true,
  });

  const context = {
    channel,
    state,
    onComplete: ({ state: finalState }) => {
      t.deepEqual(result, finalState);
    },
  };

  const event = { state: result };

  await onWorkflowComplete(context, event);
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

test('execute should pass the final result to onComplete', async (t) => {
  const channel = mockChannel(mockEventHandlers);
  const engine = await createMockRTE();
  const logger = createMockLogger();

  const plan = {
    id: 'a',
    jobs: [
      {
        expression: JSON.stringify({ done: true }),
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
        expression: JSON.stringify({ done: true }),
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
        expression: JSON.stringify({ done: true }),
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
        expression: JSON.stringify({ done: true }),
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
    // Note that these are listed in order but order isn not tested
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
        expression: 'fn(a => a)',
        adaptor: '@openfn/language-common@1.0.0',
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
