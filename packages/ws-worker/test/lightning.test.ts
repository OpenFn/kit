/*
 * Tests of Lightning-Engine server integration, from Lightning's perspective
 */

import test from 'ava';
import createLightningServer from '@openfn/lightning-mock';

import { createAttempt, createEdge, createJob } from './util';

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

test.afterEach(() => {
  lng.removeAllListeners();
});

let rollingAttemptId = 0;

const getAttempt = (ext = {}, jobs?: any) => ({
  id: `a${++rollingAttemptId}`,
  jobs: jobs || [
    {
      id: 'j',
      adaptor: '@openfn/language-common@1.0.0',
      body: 'fn(() => ({ answer: 42 }))',
    },
  ],
  ...ext,
});

test.serial(`events: lightning should respond to a ${e.CLAIM} event`, (t) => {
  return new Promise((done) => {
    lng.on(e.CLAIM, (evt) => {
      const response = evt.payload;
      t.deepEqual(response, []);
      done();
    });
  });
});

test.serial(
  `events: lightning should respond to a ${e.CLAIM} event with an attempt id and token`,
  (t) => {
    return new Promise((done) => {
      const attempt = getAttempt();
      let response;

      lng.on(e.CLAIM, ({ payload }) => {
        if (payload.length) {
          response = payload[0];
        }
      });

      lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, () => {
        const { id, token } = response;
        // Note that the payload here is what will be sent back to the worker
        t.truthy(id);
        t.truthy(token);
        t.assert(typeof token === 'string');

        done();
      });

      lng.enqueueAttempt(attempt);
    });
  }
);

test.serial(
  'should run an attempt which returns an expression as JSON',
  async (t) => {
    return new Promise((done) => {
      const attempt = {
        id: 'attempt-1',
        jobs: [
          {
            body: 'fn(() => ({ count: 122 }))',
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
      data: 66,
    });

    const attempt = {
      id: 'attempt-2',
      dataclip_id: 'x',
      jobs: [
        {
          body: 'fn((s) => s)',
        },
      ],
    };

    lng.waitForResult(attempt.id).then((result) => {
      t.deepEqual(result, { data: 66 });
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
          body: 'fn(() => ({ answer: 42 }))',
        },
      ]);

      let didCallEvent = false;
      lng.onSocketEvent(e.GET_CREDENTIAL, attempt.id, () => {
        // again there's no way to check the right credential was returned
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
        t.truthy(payload.mem.job);
        t.truthy(payload.mem.system);
        t.true(payload.mem.system > payload.mem.job);
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
  `events: lightning should receive a ${e.RUN_COMPLETE} event even if the attempt fails`,
  (t) => {
    return new Promise((done) => {
      const attempt = getAttempt({}, [
        {
          id: 'z',
          adaptor: '@openfn/language-common@1.0.0',
          body: 'err()',
        },
      ]);

      lng.onSocketEvent(e.RUN_COMPLETE, attempt.id, ({ payload }) => {
        t.is(payload.reason, 'fail');
        t.pass('called run complete');
      });

      lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, ({ payload }) => {
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
      const attempt = {
        id: 'attempt-1',
        jobs: [
          {
            body: 'fn((s) => { console.log("x"); return s })',
          },
        ],
      };

      lng.onSocketEvent(e.ATTEMPT_LOG, attempt.id, ({ payload }) => {
        const log = payload;

        t.is(log.level, 'info');
        t.truthy(log.attempt_id);
        t.truthy(log.run_id);
        t.truthy(log.message);
        t.deepEqual(log.message, ['x']);
      });

      lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
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
      { body: 'fn(() => ({ data: 1 }))', adaptor: 'common' },
      { body: 'fn(() => ({ data: 1 }))', adaptor: 'common' },
      { body: 'fn(() => ({ data: 1 }))', adaptor: 'common' },
      { body: 'fn(() => ({ data: 1 }))', adaptor: 'common' },
      { body: 'fn(() => ({ data: 1 }))', adaptor: 'common' },
      { body: 'fn(() => ({ data: 1 }))', adaptor: 'common' },
      { body: 'fn(() => ({ data: 1 }))', adaptor: 'common' },
      { body: 'fn(() => ({ data: 1 }))', adaptor: 'common' },
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

test.serial(
  'should register and de-register attempts to the server',
  async (t) => {
    return new Promise((done) => {
      const attempt = {
        id: 'attempt-1',
        jobs: [
          {
            body: 'fn(() => ({ count: 122 }))',
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
  }
);

// TODO this is a server test
// What I am testing here is that the first job completes
// before the second job starts
// TODO add wait helper
test.skip('should not claim while at capacity', async (t) => {
  return new Promise((done) => {
    const attempt1 = {
      id: 'attempt-1',
      jobs: [
        {
          body: 'wait(500)',
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

test.serial('should pass the right dataclip when running in parallel', (t) => {
  return new Promise((done) => {
    const job = (id: string) => ({
      id,
      body: `fn((s) => {  s.data.${id} = true; return s; })`,
    });

    const outputDataclipIds = {};
    const inputDataclipIds = {};
    const outputs = {};
    const a = {
      id: 'a',
      body: 'fn(() => ({ data: { a: true } }))',
      next: { j: true, k: true },
    };

    const j = job('j');
    const k = job('k');
    const x = job('x');
    const y = job('y');

    const attempt = {
      id: 'p1',
      jobs: [a, j, k, x, y],
      edges: [
        createEdge('a', 'j'),
        createEdge('a', 'k'),
        createEdge('j', 'x'),
        createEdge('k', 'y'),
      ],
    };

    // Save all the input dataclip ids for each job
    const unsub2 = lng.onSocketEvent(
      e.RUN_START,
      attempt.id,
      ({ payload }) => {
        inputDataclipIds[payload.job_id] = payload.input_dataclip_id;
      },
      false
    );

    // Save all the output dataclips & ids for each job
    const unsub1 = lng.onSocketEvent(
      e.RUN_COMPLETE,
      attempt.id,
      ({ payload }) => {
        outputDataclipIds[payload.job_id] = payload.output_dataclip_id;
        outputs[payload.job_id] = JSON.parse(payload.output_dataclip);
      },
      false
    );

    lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
      unsub1();
      unsub2();

      // Now check everything was correct

      // Job a we don't really care about, but check the output anyway
      t.deepEqual(outputs.a.data, { a: true });

      // a feeds in to j and k
      t.deepEqual(inputDataclipIds.j, outputDataclipIds.a);
      t.deepEqual(inputDataclipIds.k, outputDataclipIds.a);

      // j feeds into x
      t.deepEqual(inputDataclipIds.x, outputDataclipIds.j);

      // k feeds into y
      t.deepEqual(inputDataclipIds.y, outputDataclipIds.k);

      // x and y should have divergent states
      t.deepEqual(outputs.x.data, { a: true, j: true, x: true });
      t.deepEqual(outputs.y.data, { a: true, k: true, y: true });
      done();
    });

    lng.enqueueAttempt(attempt);
  });
});

test.serial(
  'should correctly convert edge conditions to handle downstream errors',
  (t) => {
    return new Promise((done) => {
      const a = createJob('fn(() => { throw "err" } )', 'a');
      // b should always fire
      const b = createJob('fn((s) => ({ ...s, data: 33 }) )', 'b');
      // c should only fire if b didn't error
      const c = createJob('fn((s) => ({ ...s, data: 66 }) )', 'c');

      const ab = createEdge('a', 'b');
      const bc = createEdge('b', 'c');
      bc.condition = 'on_job_success';

      const attempt = createAttempt([a, b, c], [ab, bc]);

      const results: Record<string, any> = {};

      // If job C completes, we're good here
      const unsub = lng.onSocketEvent(
        e.RUN_COMPLETE,
        attempt.id,
        (evt) => {
          results[evt.payload.job_id] = JSON.parse(evt.payload.output_dataclip);
        },
        false
      );

      lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
        t.is(evt.payload.reason, 'success');

        // What we REALLY care about is that the b-c edge condition
        // resolved to true and c executed with a result
        t.deepEqual(results.c.data, 66);
        // And that there's still an error registered for a
        t.truthy(results.c.errors.a);

        unsub();
        done();
      });

      lng.enqueueAttempt(attempt);
    });
  }
);

// Note that this test HAS to be last
// Remember this uses the mock engine, so it's not a good test of workerpool's behaviours
test.serial(
  `events: lightning should not receive ${e.CLAIM} events when the worker is stopped`,
  (t) => {
    return new Promise(async (done) => {
      await worker.destroy();

      let timeout = setTimeout(() => {
        t.pass('no more claims');
        done();
      }, 2000);

      lng.on(e.CLAIM, () => {
        t.fail('claim event received');
        clearTimeout(timeout);
        done();
      });
    });
  }
);
