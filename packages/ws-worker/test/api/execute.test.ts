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
  loadState,
  loadCredential,
} from '../../src/api/execute';
import createMockRTE from '../../src/mock/runtime-engine';
import { mockChannel } from '../../src/mock/sockets';
import { stringify } from '../../src/util';

const enc = new TextEncoder();

const toArrayBuffer = (obj: any) => enc.encode(stringify(obj));

test('jobStart should set a run id and active job on state', async (t) => {
  const plan = { id: 'attempt-1' };
  const jobId = 'job-1';

  const state = {
    plan,
  } as AttemptState;

  const channel = mockChannel({});

  onJobStart({ channel, state }, jobId);

  t.is(state.activeJob, jobId);
  t.truthy(state.activeRun);
});

test('jobStart should send a run:start event', async (t) => {
  return new Promise((done) => {
    const plan = { id: 'attempt-1' };
    const jobId = 'job-1';

    const state = {
      plan,
    } as AttemptState;

    const channel = mockChannel({
      [RUN_START]: (evt) => {
        t.is(evt.job_id, jobId);
        t.truthy(evt.run_id);

        done();
      },
    });

    onJobStart({ channel, state }, jobId);
  });
});

test('jobComplete should clear the run id and active job on state', async (t) => {
  const plan = { id: 'attempt-1' };
  const jobId = 'job-1';

  const state = {
    plan,
    activeJob: jobId,
    activeRun: 'b',
  } as AttemptState;

  const channel = mockChannel({});

  const event = { state: { x: 10 } };
  onJobComplete({ channel, state }, event);

  t.falsy(state.activeJob);
  t.falsy(state.activeRun);
});

test('jobComplete should send a run:complete event', async (t) => {
  return new Promise((done) => {
    const plan = { id: 'attempt-1' };
    const jobId = 'job-1';
    const result = { x: 10 };

    const state = {
      plan,
      activeJob: jobId,
      activeRun: 'b',
    } as AttemptState;

    const channel = mockChannel({
      [RUN_COMPLETE]: (evt) => {
        t.is(evt.job_id, jobId);
        t.truthy(evt.run_id);
        t.is(evt.output_dataclip, JSON.stringify(result));

        done();
      },
    });

    const event = { state: result };
    onJobComplete({ channel, state }, event);
  });
});

test('jobLog should should send a log event outside a run', async (t) => {
  return new Promise((done) => {
    const plan = { id: 'attempt-1' };

    const log: JSONLog = {
      name: 'R/T',
      level: 'info',
      time: new Date().getTime(),
      message: ['ping'],
    };

    const result = {
      ...log,
      attempt_id: plan.id,
    };

    const state = {
      plan,
      // No active run
    } as AttemptState;

    const channel = mockChannel({
      [ATTEMPT_LOG]: (evt) => {
        t.deepEqual(evt, result);
        done();
      },
    });

    onJobLog({ channel, state }, log);
  });
});

test('jobLog should should send a log event inside a run', async (t) => {
  return new Promise((done) => {
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
        t.is(evt.name, log.name);
        t.is(evt.time, log.time);
        done();
      },
    });

    onJobLog({ channel, state }, log);
  });
});

test('workflowStart should send an empty attempt:start event', async (t) => {
  return new Promise((done) => {
    const channel = mockChannel({
      [ATTEMPT_START]: () => {
        t.pass();

        done();
      },
    });

    onWorkflowStart({ channel });
  });
});

test('workflowComplete should send an attempt:complete event', async (t) => {
  return new Promise((done) => {
    const state = {} as AttemptState;

    const result = { answer: 42 };

    const channel = mockChannel({
      [ATTEMPT_COMPLETE]: (evt) => {
        t.deepEqual(evt.dataclip, JSON.stringify(result));
        t.deepEqual(state.result, result);

        done();
      },
    });

    const event = { state: result };

    const context = { channel, state, onComplete: () => {} };
    onWorkflowComplete(context, event);
  });
});

test('workflowComplete should call onComplete with state', async (t) => {
  return new Promise((done) => {
    const state = {} as AttemptState;

    const result = { answer: 42 };

    const channel = mockChannel();

    const context = {
      channel,
      state,
      onComplete: (finalState) => {
        t.deepEqual(result, finalState);
        done();
      },
    };

    const event = { state: result };

    onWorkflowComplete(context, event);
  });
});

// TODO what if an error?
test('loadState should fetch a dataclip', async (t) => {
  const channel = mockChannel({
    [GET_DATACLIP]: ({ dataclip_id }) => {
      t.is(dataclip_id, 'xyz');
      return toArrayBuffer({ data: {} });
    },
  });

  const state = await loadState(channel, 'xyz');
  t.deepEqual(state, { data: {} });
});

// TODO what if an error?
test('loadCredential should fetch a credential', async (t) => {
  const channel = mockChannel({
    [GET_CREDENTIAL]: ({ credential_id }) => {
      t.is(credential_id, 'jfk');
      return { apiKey: 'abc' };
    },
  });

  const state = await loadCredential(channel, 'jfk');
  t.deepEqual(state, { apiKey: 'abc' });
});

test('execute should return the final result', async (t) => {
  const channel = mockChannel();
  const engine = createMockRTE();
  const logger = createMockLogger();

  const plan = {
    id: 'a',
    jobs: [
      {
        expression: JSON.stringify({ done: true }),
      },
    ],
  };

  const result = await execute(channel, engine, logger, plan);

  t.deepEqual(result, { done: true });
});

// TODO this is more of an engine test really, but worth having I suppose
test('execute should lazy-load a credential', async (t) => {
  const logger = createMockLogger();
  let didCallCredentials = false;

  const channel = mockChannel({
    [GET_CREDENTIAL]: (id) => {
      t.truthy(id);
      didCallCredentials = true;
      return {};
    },
  });
  const engine = createMockRTE('rte');

  const plan = {
    id: 'a',
    jobs: [
      {
        configuration: 'abc',
        expression: JSON.stringify({ done: true }),
      },
    ],
  };

  await execute(channel, engine, logger, plan);

  t.true(didCallCredentials);
});

// TODO this is more of an engine test really, but worth having I suppose
test('execute should lazy-load initial state', async (t) => {
  const logger = createMockLogger();
  let didCallState = false;

  const channel = mockChannel({
    [GET_DATACLIP]: (id) => {
      t.truthy(id);
      didCallState = true;
      return toArrayBuffer({});
    },
  });
  const engine = createMockRTE('rte');

  const plan = {
    id: 'a',
    jobs: [
      {
        state: 'abc',
        expression: JSON.stringify({ done: true }),
      },
    ],
  };

  await execute(channel, engine, logger, plan);

  t.true(didCallState);
});

test('execute should call all events on the socket', async (t) => {
  const logger = createMockLogger();
  const engine = createMockRTE();

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

  await execute(channel, engine, logger, plan);

  // check result is what we expect

  // Check that events were passed to the socket
  // This is deliberately crude
  t.assert(allEvents.every((e) => events[e]));
});
