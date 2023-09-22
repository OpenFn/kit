import test from 'ava';
import {
  GET_ATTEMPT,
  RUN_START,
  RUN_COMPLETE,
  ATTEMPT_LOG,
} from '../src/events';
import {
  prepareAttempt,
  onJobStart,
  onJobComplete,
  onJobLog,
  execute,
} from '../src/worker';
import { attempts } from './mock/data';
import { JSONLog } from '@openfn/logger';
import createMockRTM from '../src/mock/runtime-manager';

// This is a fake/mock websocket used by mocks

// TODO throw in the handler to get an error?

test('prepareAttempt should get the attempt body', async (t) => {
  const attempt = attempts['attempt-1'];
  let didCallGetAttempt = false;
  const channel = mockChannel({
    [GET_ATTEMPT]: () => {
      // TODO should be no payload (or empty payload)
      didCallGetAttempt = true;
      return attempt;
    },
  });

  await prepareAttempt(channel, 'a1');
  t.true(didCallGetAttempt);
});

test('prepareAttempt should return an execution plan', async (t) => {
  const attempt = attempts['attempt-1'];

  const channel = mockChannel({
    [GET_ATTEMPT]: () => attempt,
  });

  const plan = await prepareAttempt(channel, 'a1');
  t.deepEqual(plan, {
    id: 'attempt-1',
    jobs: [
      {
        id: 'trigger',
        configuration: 'a',
        expression: 'fn(a => a)',
        adaptor: '@openfn/language-common@1.0.0',
      },
    ],
  });
});

test('jobStart should set a run id and active job on state', async (t) => {
  const plan = { id: 'attempt-1' };
  const jobId = 'job-1';

  const state = {
    plan,
  };

  const channel = mockChannel({});

  onJobStart(channel, state, jobId);

  t.is(state.activeJob, jobId);
  t.truthy(state.activeRun);
});

test('jobStart should send a run:start event', async (t) => {
  return new Promise((done) => {
    const plan = { id: 'attempt-1' };
    const jobId = 'job-1';

    const state = {
      plan,
    };

    const channel = mockChannel({
      [RUN_START]: (evt) => {
        t.is(evt.job_id, jobId);
        t.truthy(evt.run_id);

        done();
      },
    });

    onJobStart(channel, state, jobId);
  });
});

test('jobEnd should clear the run id and active job on state', async (t) => {
  const plan = { id: 'attempt-1' };
  const jobId = 'job-1';

  const state = {
    plan,
    activeJob: jobId,
    activeRun: 'b',
  };

  const channel = mockChannel({});

  onJobComplete(channel, state, jobId);

  t.falsy(state.activeJob);
  t.falsy(state.activeRun);
});

test('jobComplete should send a run:complete event', async (t) => {
  return new Promise((done) => {
    const plan = { id: 'attempt-1' };
    const jobId = 'job-1';

    const state = {
      plan,
      activeJob: jobId,
      activeRun: 'b',
    };

    const channel = mockChannel({
      [RUN_COMPLETE]: (evt) => {
        t.is(evt.job_id, jobId);
        t.truthy(evt.run_id);

        done();
      },
    });

    onJobComplete(channel, state, jobId);
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
    };

    const channel = mockChannel({
      [ATTEMPT_LOG]: (evt) => {
        t.deepEqual(evt, result);
        done();
      },
    });

    onJobLog(channel, state, log);
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
    };

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

    onJobLog(channel, state, log);
  });
});

// TODO test the whole execute workflow

// run this against the mock - this just ensures that execute
// binds all the events
test.skip('execute should call all events', async (t) => {
  const events = {};

  const rtm = createMockRTM();

  const channel = mockChannel({
    [ATTEMPT_LOG]: (evt) => {
      events[ATTEMPT_LOG] = evt;
    },
  });

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

  const result = await execute(channel, rtm, plan);

  // check result is what we expect

  // Check that events were passed to the socket
  // This is deliberately crude
  t.truthy(events[ATTEMPT_LOG]);
});
