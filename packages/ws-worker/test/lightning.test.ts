/*
 * Tests of Lightning-Engine server integration, from Lightning's perspective
 */

import test from 'ava';
import type {
  LightningPlan,
  RunCompletePayload,
} from '@openfn/lexicon/lightning';
import createLightningServer, {
  generateKeys,
  toBase64,
} from '@openfn/lightning-mock';

import { createRun, createEdge, createJob, sleep } from './util';
import createWorkerServer from '../src/server';
import * as e from '../src/events';
import createMockRTE from '../src/mock/runtime-engine';

let lng: any;
let worker: any;
let engine: any;

let keys = { private: '.', public: '.' };

const urls = {
  worker: 'http://localhost:4567',
  lng: 'ws://localhost:7654/worker',
};

test.before(async () => {
  keys = await generateKeys();

  engine = await createMockRTE();
  lng = createLightningServer({
    port: 7654,
    runPrivateKey: toBase64(keys.private),
  });

  worker = createWorkerServer(engine, {
    port: 4567,
    lightning: urls.lng,
    secret: 'abc',
    maxWorkflows: 1,

    // Note that if this is not passed,
    // JWT verification will be skipped
    runPublicKey: keys.public,
    backoff: {
      min: 1,
      max: 1000,
    },
  });
});

test.afterEach(() => {
  lng.removeAllListeners();
});

let rollingRunId = 0;

const getRun = (ext = {}, jobs?: any[]): LightningPlan =>
  ({
    id: `a${++rollingRunId}`,
    jobs: jobs || [
      {
        id: 'j',
        adaptor: '@openfn/language-common@1.0.0',
        body: 'fn(() => ({ answer: 42 }))',
      },
    ],
    ...ext,
  } as LightningPlan);

test.serial(`events: lightning should respond to a ${e.CLAIM} event`, (t) => {
  return new Promise((done) => {
    lng.on(e.CLAIM, (evt: any) => {
      const response = evt.payload;
      t.deepEqual(response, []);
      done();
    });
  });
});

test.serial(
  `events: lightning should respond to a ${e.CLAIM} event with an run id and token`,
  (t) => {
    return new Promise((done) => {
      const run = getRun();
      let response: any;

      lng.on(e.CLAIM, ({ payload }: any) => {
        if (payload.length) {
          response = payload[0];
        }
      });

      lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
        const { id, token } = response;
        // Note that the payload here is what will be sent back to the worker
        t.truthy(id);
        t.truthy(token);
        t.assert(typeof token === 'string');

        done();
      });

      lng.enqueueRun(run);
    });
  }
);

test.serial(`should not claim while at capacity, then resume`, (t) => {
  return new Promise((done) => {
    let runIsActive = false;
    let runComplete = false;
    let didClaimAfterComplete = false;

    const run = {
      id: `a${++rollingRunId}`,
      jobs: [
        {
          id: 'j',
          adaptor: '@openfn/language-common@1.0.0',
          body: `fn(() => new Promise((resolve) => {
              setTimeout(resolve, 500)
            }))`,
        },
      ],
    };

    lng.on(e.CLAIM, () => {
      if (runIsActive) {
        t.fail('Claimed while run is active');
      }
      if (runComplete) {
        didClaimAfterComplete = true;
      }
    });

    lng.onSocketEvent(e.RUN_START, run.id, () => {
      runIsActive = true;
    });

    lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
      runIsActive = false;
      runComplete = true;

      setTimeout(() => {
        t.true(didClaimAfterComplete);
        done();
      }, 10);
    });

    lng.enqueueRun(run);
  });
});

test.serial(`should reset backoff after claim`, (t) => {
  return new Promise((done) => {
    let lastClaim = Date.now();
    let lastClaimDiff = 0;

    const run = {
      id: `a${++rollingRunId}`,
      jobs: [
        {
          id: 'j',
          adaptor: '@openfn/language-common@1.0.0',
          body: `fn(() => new Promise((resolve) => {
              setTimeout(resolve, 500)
            }))`,
        },
      ],
    };

    lng.on(e.CLAIM, () => {
      lastClaimDiff = Date.now() - lastClaim;
      lastClaim = Date.now();
    });

    lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
      // set this articially high - if there are no more claims, the test will fail
      lastClaimDiff = 10000;

      // When the run is finished, the claims should resume
      // but with a smaller backoff
      setTimeout(() => {
        t.log('Backoff after run:', lastClaimDiff);
        t.true(lastClaimDiff < 5);
        done();
      }, 10);
    });

    setTimeout(() => {
      t.log('Backoff before run:', lastClaimDiff);
      // let the backoff increase a bit
      // the last claim diff should be at least 20ms
      t.true(lastClaimDiff > 20);

      lng.enqueueRun(run);
    }, 600);
  });
});

test.todo('worker should log when a run token is verified');

// Perhaps a workflow exception is the most responsible thing right now
test.todo(
  'worker throws or blow up or something when token verification fails'
);

test.serial(
  'should run a run which returns an expression as JSON',
  async (t) => {
    return new Promise((done) => {
      const run = {
        id: 'run-1',
        jobs: [
          {
            body: 'fn(() => ({ count: 122 }))',
          },
        ],
      };

      lng.waitForResult(run.id).then((result: any) => {
        t.deepEqual(result, { count: 122 });
        done();
      });

      lng.enqueueRun(run);
    });
  }
);

test.serial('should run a run which returns initial state', async (t) => {
  return new Promise((done) => {
    lng.addDataclip('x', {
      data: 66,
    });

    const run = {
      id: 'run-2',
      dataclip_id: 'x',
      jobs: [
        {
          body: 'fn((s) => s)',
        },
      ],
    };

    lng.waitForResult(run.id).then((result: any) => {
      t.deepEqual(result, { data: 66 });
      done();
    });

    lng.enqueueRun(run);
  });
});

// A basic high level integration test to ensure the whole loop works
// This checks the events received by the lightning websocket
test.serial(
  'worker should pull an event from lightning, lightning should receive run-complete',
  (t) => {
    return new Promise((done) => {
      const run = getRun();
      lng.onSocketEvent(e.RUN_COMPLETE, run.id, (evt: any) => {
        const { final_dataclip_id } = evt.payload;
        t.assert(typeof final_dataclip_id === 'string');
        t.pass('run complete event received');
        done();
      });

      lng.enqueueRun(run);
    });
  }
);

test.todo(`events: lightning should receive a ${e.RUN_START} event`);

// Now run detailed checks of every event
// for each event we can see a copy of the server state
// (if that helps anything?)

test.serial(`events: lightning should receive a ${e.GET_PLAN} event`, (t) => {
  return new Promise((done) => {
    const run = getRun();

    let didCallEvent = false;
    lng.onSocketEvent(e.GET_PLAN, run.id, () => {
      // This doesn't test that the correct run gets sent back
      // We'd have to add an event to the engine for that
      // (not a bad idea)
      didCallEvent = true;
    });

    lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
      t.true(didCallEvent);
      done();
    });

    lng.enqueueRun(run);
  });
});

test.serial(
  `events: lightning should receive a ${e.GET_CREDENTIAL} event`,
  (t) => {
    return new Promise((done) => {
      lng.addCredential('a', {});

      const run = getRun({}, [
        {
          id: 'some-job',
          credential_id: 'a',
          adaptor: '@openfn/language-common@1.0.0',
          body: 'fn(() => ({ answer: 42 }))',
        },
      ]);

      let didCallEvent = false;
      lng.onSocketEvent(e.GET_CREDENTIAL, run.id, () => {
        // again there's no way to check the right credential was returned
        didCallEvent = true;
      });

      lng.onSocketEvent(e.RUN_COMPLETE, run.id, ({ payload }: any) => {
        t.is(payload.reason, 'success');
        t.true(didCallEvent);
        done();
      });

      lng.enqueueRun(run);
    });
  }
);

test.serial(
  `events: lightning should receive a ${e.GET_DATACLIP} event`,
  (t) => {
    return new Promise((done) => {
      lng.addDataclip('abc', { result: true });

      const run = getRun({
        dataclip_id: 'abc',
      });

      let didCallEvent = false;
      lng.onSocketEvent(e.GET_DATACLIP, run.id, ({ payload }: any) => {
        // payload is the incoming/request payload - this tells us which dataclip
        // the worker is asking for
        // Note that it doesn't tell us much about what is returned
        // (and we can't tell from this event either)
        t.is(payload.id, 'abc');
        didCallEvent = true;
      });

      lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
        t.true(didCallEvent);
        done();
      });

      lng.enqueueRun(run);
    });
  }
);

test.serial(
  `events: worker should send an error if ${e.GET_DATACLIP} references a non-existant dataclip`,
  (t) => {
    return new Promise((done) => {
      const run = getRun({
        dataclip_id: 'xyz',
      });
      // Do not load the dataclip into lightning

      let didCallEvent = false;
      lng.onSocketEvent(e.GET_DATACLIP, run.id, () => {
        didCallEvent = true;
      });

      lng.onSocketEvent(
        e.RUN_COMPLETE,
        run.id,
        ({ payload }: { payload: RunCompletePayload }) => {
          t.true(didCallEvent);
          t.is(payload.reason, 'exception');
          t.is(payload.error_type, 'DataClipError');
          t.regex(payload.error_message!, /Failed to load dataclip xyz/);
          done();
        }
      );

      lng.enqueueRun(run);
    });
  }
);

test.serial(`events: lightning should receive a ${e.STEP_START} event`, (t) => {
  return new Promise((done) => {
    const run = getRun();

    lng.onSocketEvent(e.STEP_START, run.id, ({ payload }: any) => {
      t.is(payload.job_id, 'j');
      t.truthy(payload.step_id);
      t.pass('called run start');
    });

    lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
      done();
    });

    lng.enqueueRun(run);
  });
});

test.serial(
  `events: lightning should receive a ${e.STEP_COMPLETE} event`,
  (t) => {
    return new Promise((done) => {
      const run = getRun();

      lng.onSocketEvent(e.STEP_COMPLETE, run.id, ({ payload }: any) => {
        t.is(payload.job_id, 'j');
        t.truthy(payload.step_id);
        t.truthy(payload.output_dataclip);
        t.truthy(payload.output_dataclip_id);
        t.truthy(payload.mem.job);
        t.truthy(payload.mem.system);
        t.true(payload.mem.system > payload.mem.job);
        t.pass('called run complete');
      });

      lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
        done();
      });

      lng.enqueueRun(run);
    });
  }
);

test.serial(
  `events: lightning should receive a ${e.STEP_COMPLETE} event even if the run fails`,
  (t) => {
    return new Promise((done) => {
      const run = getRun({}, [
        {
          id: 'z',
          adaptor: '@openfn/language-common@1.0.0',
          body: 'err()',
        },
      ]);

      lng.onSocketEvent(e.STEP_COMPLETE, run.id, ({ payload }: any) => {
        t.is(payload.reason, 'fail');
        t.pass('called step complete');
      });

      lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
        done();
      });

      lng.enqueueRun(run);
    });
  }
);

test.serial(`events: ${e.STEP_COMPLETE} should not return dataclips`, (t) => {
  return new Promise((done) => {
    const run = getRun();
    run.options = {
      output_dataclips: false,
    };

    lng.onSocketEvent(e.STEP_COMPLETE, run.id, ({ payload }: any) => {
      t.is(payload.job_id, 'j');
      t.falsy(payload.output_dataclip);
      t.truthy(payload.output_dataclip_id);
      t.pass();
    });

    lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
      done();
    });

    lng.enqueueRun(run);
  });
});

test.serial(`events: lightning should receive a ${e.RUN_LOG} event`, (t) => {
  return new Promise((done) => {
    const run = {
      id: 'run-1',
      jobs: [
        {
          body: 'fn((s) => { console.log("x"); return s })',
        },
      ],
    };

    lng.onSocketEvent(
      e.RUN_LOG,
      run.id,
      ({ payload }: any) => {
        if (payload.source === 'JOB') {
          const log = payload;

          t.is(log.level, 'info');
          t.truthy(log.run_id);
          t.truthy(log.step_id);
          t.truthy(log.message);
          t.deepEqual(log.message, ['x']);
        }
      },
      false
    );

    lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
      done();
    });

    lng.enqueueRun(run);
  });
});

// Skipping because this is flaky at microsecond resolution
// See branch hrtime-send-nanoseconds-to-lightning where this should be more robust
test.serial.skip(`events: logs should have increasing timestamps`, (t) => {
  return new Promise((done) => {
    const run = getRun({}, [
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
      e.RUN_LOG,
      run.id,
      ({ payload }: any) => {
        history.push(BigInt(payload.timestamp));
      },
      false
    );

    lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
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

    lng.enqueueRun(run);
  });
});

// This is well tested elsewhere but including here for completeness
test.serial(
  `events: lightning should receive a ${e.RUN_COMPLETE} event`,
  (t) => {
    return new Promise((done) => {
      const run = getRun();

      lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
        t.pass('called run:complete');
        done();
      });

      lng.enqueueRun(run);
    });
  }
);

test.serial('should register and de-register runs to the server', async (t) => {
  return new Promise((done) => {
    const run = {
      id: 'run-1',
      jobs: [
        {
          body: 'fn(() => ({ count: 122 }))',
        },
      ],
    };

    worker.on(e.RUN_START, () => {
      t.truthy(worker.workflows[run.id]);
    });

    lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
      t.truthy(worker.workflows[run.id]);
      // Tidyup is done AFTER lightning receives the event
      // This timeout is crude but should work
      setTimeout(() => {
        t.falsy(worker.workflows[run.id]);
        done();
      }, 10);
    });

    lng.enqueueRun(run);
  });
});

// TODO this is a server test
// What I am testing here is that the first job completes
// before the second job starts
// TODO add wait helper
test.skip('should not claim while at capacity', async (t) => {
  return new Promise((done) => {
    const run1 = {
      id: 'run-1',
      jobs: [
        {
          body: 'wait(500)',
        },
      ],
    };

    const run2 = {
      ...run1,
      id: 'run-2',
    };

    let run1Start: any;

    // When the first run starts, we should only have run 1 in progress
    lng.onSocketEvent(e.RUN_START, run1.id, () => {
      run1Start = Date.now();

      t.truthy(worker.workflows[run1.id]);
      t.falsy(worker.workflows[run2.id]);
    });

    // When the second run starts, we should only have run 2 in progress
    lng.onSocketEvent(e.RUN_START, run2.id, () => {
      const duration = Date.now() - run1Start;
      t.true(duration > 490);

      t.falsy(worker.workflows[run1.id]);
      t.truthy(worker.workflows[run2.id]);

      // also, the now date should be around 500 ms after the first start
    });

    lng.onSocketEvent(e.RUN_COMPLETE, run2.id, () => {
      done();
    });

    lng.enqueueRun(run1);
    lng.enqueueRun(run2);
  });
});

test.serial('should pass the right dataclip when running in parallel', (t) => {
  return new Promise((done) => {
    const job = (id: string) => ({
      id,
      body: `fn((s) => {  s.data.${id} = true; return s; })`,
    });

    const outputDataclipIds: any = {};
    const inputDataclipIds: any = {};
    const outputs: any = {};
    const a = {
      id: 'a',
      body: 'fn(() => ({ data: { a: true } }))',
      next: { j: true, k: true },
    };

    const j = job('j');
    const k = job('k');
    const x = job('x');
    const y = job('y');

    const run = {
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
      e.STEP_START,
      run.id,
      ({ payload }: any) => {
        inputDataclipIds[payload.job_id] = payload.input_dataclip_id;
      },
      false
    );

    // Save all the output dataclips & ids for each job
    const unsub1 = lng.onSocketEvent(
      e.STEP_COMPLETE,
      run.id,
      ({ payload }: any) => {
        outputDataclipIds[payload.job_id] = payload.output_dataclip_id;
        outputs[payload.job_id] = JSON.parse(payload.output_dataclip);
      },
      false
    );

    lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
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

    lng.enqueueRun(run);
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

      const run = createRun([a, b, c] as any, [ab, bc] as any);

      const results: Record<string, any> = {};

      // If job C completes, we're good here
      const unsub = lng.onSocketEvent(
        e.STEP_COMPLETE,
        run.id,
        (evt: any) => {
          results[evt.payload.job_id] = JSON.parse(evt.payload.output_dataclip);
        },
        false
      );

      lng.onSocketEvent(e.RUN_COMPLETE, run.id, (evt: any) => {
        t.is(evt.payload.reason, 'success');

        // What we REALLY care about is that the b-c edge condition
        // resolved to true and c executed with a result
        t.deepEqual(results.c.data, 66);
        // And that there's still an error registered for a
        t.truthy(results.c.errors.a);

        unsub();
        done();
      });

      lng.enqueueRun(run);
    });
  }
);

test.serial(`worker should send a success reason in the logs`, (t) => {
  return new Promise((done) => {
    let log: any;

    const run = {
      id: 'run-1',
      jobs: [
        {
          body: 'fn((s) => { return s })',
        },
      ],
    };

    lng.onSocketEvent(
      e.RUN_LOG,
      run.id,
      ({ payload }: any) => {
        if (payload.message[0].match(/Run complete with status: success/)) {
          log = payload.message[0];
        }
      },
      false
    );

    lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
      t.truthy(log);
      done();
    });

    lng.enqueueRun(run);
  });
});

test.serial(`worker should send a fail reason in the logs`, (t) => {
  return new Promise((done) => {
    let log: any;

    const run = {
      id: 'run-1',
      jobs: [
        {
          body: 'fn((s) => { throw "blah" })',
        },
      ],
    };

    lng.onSocketEvent(
      e.RUN_LOG,
      run.id,
      ({ payload }: any) => {
        if (payload.message[0].match(/Run complete with status: fail/)) {
          log = payload.message[0];
        }
      },
      false
    );

    lng.onSocketEvent(e.RUN_COMPLETE, run.id, () => {
      t.truthy(log);
      t.regex(log, /JobError: blah/i);
      done();
    });

    lng.enqueueRun(run);
  });
});

test.serial('worker should accept a custom socket timeout', async (t) => {
  // re-create the lightning server with a timeout
  lng = createLightningServer({
    port: 7655,
    runPrivateKey: toBase64(keys.private),
    socketDelay: 500,
  });

  worker = createWorkerServer(engine, {
    port: 4568,
    lightning: 'ws://localhost:7655/worker',
    secret: 'abc',
    maxWorkflows: 1,
    socketTimeoutSeconds: 0.1,
  });

  // should fail to claim
  const run = getRun();
  lng.enqueueRun(run);

  lng.onSocketEvent(e.RUN_START, run.id, () => {
    t.fail('Run started');
  });

  await sleep(500);
  t.pass('Run did not start');
});

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
