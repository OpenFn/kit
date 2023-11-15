/*
 * Tests of Lightning-Engine server integration, from Lightning's perspective
 */

import test from 'ava';
import createLightningServer from '@openfn/lightning-mock';
import createWorkerServer from '../src/server';
import createMockRTE from '../src/mock/runtime-engine';
import * as e from '../src/events';

let lng;
let worker;

const urls = {
  worker: 'http://localhost:4567',
  lng: 'ws://localhost:7654/worker',
};

test.before(async () => {
  const engine = await createMockRTE();
  // TODO give lightning the same secret and do some validation
  lng = createLightningServer({ port: 7654 });
  worker = createWorkerServer(engine, {
    port: 4567,
    lightning: urls.lng,
    secret: 'abc',
    maxWorkflows: 1,
  });
});

let rollingAttemptId = 0;

const getAttempt = (ext = {}, jobs?: any) => ({
  id: `a${++rollingAttemptId}`,
  jobs: jobs || [
    {
      id: 'j',
      adaptor: '@openfn/language-common@1.0.0',
      body: JSON.stringify({ answer: 42 }),
    },
  ],
  ...ext,
});

// these are really just tests of the mock architecture, but worth having
test.serial(
  'should run an attempt through the mock runtime which returns an expression as JSON',
  async (t) => {
    return new Promise((done) => {
      const attempt = {
        id: 'attempt-1',
        jobs: [
          {
            body: JSON.stringify({ count: 122 }),
          },
        ],
      };

      lng.waitForResult(attempt.id).then((result) => {
        t.deepEqual(result, { count: 122 });
        done();
      });

      lng.enqueueAttempt(attempt);
    });
  }
);

test.serial('should run an attempt which returns intial state', async (t) => {
  return new Promise((done) => {
    lng.addDataclip('x', {
      route: 66,
    });

    const attempt = {
      id: 'attempt-2',
      dataclip_id: 'x',
      jobs: [
        {
          body: 'whatever',
        },
      ],
    };

    lng.waitForResult(attempt.id).then((result) => {
      t.deepEqual(result, { route: 66 });
      done();
    });

    lng.enqueueAttempt(attempt);
  });
});

// A basic high level integration test to ensure the whole loop works
// This checks the events received by the lightning websocket
test.serial(
  'worker should pull an event from lightning, lightning should receive attempt-complete',
  (t) => {
    return new Promise((done) => {
      const attempt = getAttempt();
      lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
        const { final_dataclip_id } = evt.payload;
        t.assert(typeof final_dataclip_id === 'string');
        t.pass('attempt complete event received');
        done();
      });

      lng.enqueueAttempt(attempt);
    });
  }
);

test.todo(`events: lightning should receive a ${e.ATTEMPT_START} event`);

// Now run detailed checks of every event
// for each event we can see a copy of the server state
// (if that helps anything?)

test.serial(`events: lightning should receive a ${e.CLAIM} event`, (t) => {
  return new Promise((done) => {
    const attempt = getAttempt();
    let didCallEvent = false;
    lng.onSocketEvent(e.CLAIM, attempt.id, ({ payload }) => {
      const { id, token } = payload;
      // Note that the payload here is what will be sent back to the worker
      // TODO check there's a token
      t.truthy(id);
      t.truthy(token);
      t.assert(typeof token === 'string');

      didCallEvent = true;
    });

    lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
      t.true(didCallEvent);
      done();
    });

    lng.enqueueAttempt(attempt);
  });
});

test.serial(
  `events: lightning should receive a ${e.GET_ATTEMPT} event`,
  (t) => {
    return new Promise((done) => {
      const attempt = getAttempt();

      let didCallEvent = false;
      lng.onSocketEvent(e.GET_ATTEMPT, attempt.id, ({ payload }) => {
        // This doesn't test that the correct attempt gets sent back
        // We'd have to add an event to the engine for that
        // (not a bad idea)
        didCallEvent = true;
      });

      lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
        t.true(didCallEvent);
        done();
      });

      lng.enqueueAttempt(attempt);
    });
  }
);

test.serial(
  `events: lightning should receive a ${e.GET_CREDENTIAL} event`,
  (t) => {
    return new Promise((done) => {
      const attempt = getAttempt({}, [
        {
          id: 'some-job',
          credential_id: 'a',
          adaptor: '@openfn/language-common@1.0.0',
          body: JSON.stringify({ answer: 42 }),
        },
      ]);

      let didCallEvent = false;
      lng.onSocketEvent(e.GET_CREDENTIAL, attempt.id, ({ payload }) => {
        // again there's no way to check the right credential was returned
        didCallEvent = true;
      });

      lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
        t.true(didCallEvent);
        done();
      });

      lng.enqueueAttempt(attempt);
    });
  }
);

test.serial(
  `events: lightning should receive a ${e.GET_DATACLIP} event`,
  (t) => {
    return new Promise((done) => {
      lng.addDataclip('abc', { result: true });

      const attempt = getAttempt({
        dataclip_id: 'abc',
      });

      let didCallEvent = false;
      lng.onSocketEvent(e.GET_DATACLIP, attempt.id, ({ payload }) => {
        // payload is the incoming/request payload - this tells us which dataclip
        // the worker is asking for
        // Note that it doesn't tell us much about what is returned
        // (and we can't tell from this event either)
        t.is(payload.id, 'abc');
        didCallEvent = true;
      });

      lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, () => {
        t.true(didCallEvent);
        done();
      });

      lng.enqueueAttempt(attempt);
    });
  }
);

test.serial(`events: lightning should receive a ${e.RUN_START} event`, (t) => {
  return new Promise((done) => {
    const attempt = getAttempt();

    lng.onSocketEvent(e.RUN_START, attempt.id, ({ payload }) => {
      t.is(payload.job_id, 'j');
      t.truthy(payload.run_id);
      t.pass('called run start');
    });

    lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
      done();
    });

    lng.enqueueAttempt(attempt);
  });
});

test.serial(
  `events: lightning should receive a ${e.RUN_COMPLETE} event`,
  (t) => {
    return new Promise((done) => {
      const attempt = getAttempt();

      lng.onSocketEvent(e.RUN_COMPLETE, attempt.id, ({ payload }) => {
        t.is(payload.job_id, 'j');
        t.truthy(payload.run_id);
        t.truthy(payload.output_dataclip);
        t.truthy(payload.output_dataclip_id);
        t.pass('called run complete');
      });

      lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
        done();
      });

      lng.enqueueAttempt(attempt);
    });
  }
);

test.serial(
  `events: lightning should receive a ${e.ATTEMPT_LOG} event`,
  (t) => {
    return new Promise((done) => {
      const attempt = getAttempt();

      let didCallEvent = false;

      // The mock runtime will put out a default log
      lng.onSocketEvent(e.ATTEMPT_LOG, attempt.id, ({ payload }) => {
        const log = payload;

        t.is(log.level, 'info');
        t.truthy(log.attempt_id);
        t.truthy(log.run_id);
        t.truthy(log.message);
        t.assert(log.message[0].startsWith('Running job'));

        didCallEvent = true;
      });

      lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
        t.true(didCallEvent);
        done();
      });

      lng.enqueueAttempt(attempt);
    });
  }
);

// Skipping because this is flaky at microsecond resolution
// See branch hrtime-send-nanoseconds-to-lightning where this should be more robust
test.serial.skip(`events: logs should have increasing timestamps`, (t) => {
  return new Promise((done) => {
    const attempt = getAttempt({}, [
      { body: '{ x: 1 }', adaptor: 'common' },
      { body: '{ x: 1 }', adaptor: 'common' },
      { body: '{ x: 1 }', adaptor: 'common' },
      { body: '{ x: 1 }', adaptor: 'common' },
      { body: '{ x: 1 }', adaptor: 'common' },
      { body: '{ x: 1 }', adaptor: 'common' },
      { body: '{ x: 1 }', adaptor: 'common' },
    ]);

    const history: bigint[] = [];

    // Track the timestamps on any logs that come out
    lng.onSocketEvent(
      e.ATTEMPT_LOG,
      attempt.id,
      ({ payload }) => {
        history.push(BigInt(payload.timestamp));
      },
      false
    );

    lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
      t.log(history);
      let last = BigInt(0);

      // There is a significant chance that some logs will come out with
      // the same timestamp
      // So we add some leniency
      let lives = 3;

      history.forEach((time) => {
        if (time === last) {
          lives -= 1;
          t.true(lives > 0);
          // skip
          return;
        }
        t.true(time > last);
        lives = 2;
        last = time;
      });

      done();
    });

    lng.enqueueAttempt(attempt);
  });
});

// This is well tested elsewhere but including here for completeness
test.serial(
  `events: lightning should receive a ${e.ATTEMPT_COMPLETE} event`,
  (t) => {
    return new Promise((done) => {
      const attempt = getAttempt();

      lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
        t.pass('called attempt:complete');
        done();
      });

      lng.enqueueAttempt(attempt);
    });
  }
);

test('should register and de-register attempts to the server', async (t) => {
  return new Promise((done) => {
    const attempt = {
      id: 'attempt-1',
      jobs: [
        {
          body: JSON.stringify({ count: 122 }),
        },
      ],
    };

    worker.on(e.ATTEMPT_START, () => {
      t.truthy(worker.workflows[attempt.id]);
    });

    lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
      t.truthy(worker.workflows[attempt.id]);
      // Tidyup is done AFTER lightning receives the event
      // This timeout is crude but should work
      setTimeout(() => {
        t.falsy(worker.workflows[attempt.id]);
        done();
      }, 10);
    });

    lng.enqueueAttempt(attempt);
  });
});

// TODO this is a server test
// What I am testing here is that the first job completes
// before the second job starts
test('should not claim while at capacity', async (t) => {
  return new Promise((done) => {
    const attempt1 = {
      id: 'attempt-1',
      jobs: [
        {
          body: 'wait@500',
        },
      ],
    };

    const attempt2 = {
      ...attempt1,
      id: 'attempt-2',
    };

    let attempt1Start;

    // When the first attempt starts, we should only have attempt 1 in progress
    lng.onSocketEvent(e.ATTEMPT_START, attempt1.id, (evt) => {
      attempt1Start = Date.now();

      t.truthy(worker.workflows[attempt1.id]);
      t.falsy(worker.workflows[attempt2.id]);
    });

    // When the second attempt starts, we should only have attempt 2 in progress
    lng.onSocketEvent(e.ATTEMPT_START, attempt2.id, (evt) => {
      const duration = Date.now() - attempt1Start;
      t.true(duration > 490);

      t.falsy(worker.workflows[attempt1.id]);
      t.truthy(worker.workflows[attempt2.id]);

      // also, the now date should be around 500 ms after the first start
    });

    lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt2.id, (evt) => {
      done();
    });

    lng.enqueueAttempt(attempt1);
    lng.enqueueAttempt(attempt2);
  });
});

// hmm, i don't even think I can test this in the mock runtime
test.skip('should pass the right dataclip when running in parallel', () => {});

test.todo(`should run multiple attempts`);
