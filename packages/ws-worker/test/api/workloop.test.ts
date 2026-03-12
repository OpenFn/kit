import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import { sleep } from '../util';
import { mockChannel } from '../../src/mock/sockets';
import startWorkloop from '../../src/api/workloop';
import { CLAIM } from '../../src/events';
import EventEmitter from 'node:events';
import { createWorkloop, Workloop } from '../../src/util/parse-workloops';

let currentWorkloop: Workloop;

const logger = createMockLogger();

test.afterEach(() => {
  currentWorkloop?.stop(); // cancel any workloops
});

const createMockWorkloop = (capacity = 5): Workloop =>
  createWorkloop({ queues: ['manual', '*'], capacity });

const createMockApp = (props: any) => ({
  workflows: {},
  openClaims: {},
  queueChannel: mockChannel({
    [CLAIM]: () => {
      return { runs: [] };
    },
  }),
  execute: () => {},
  runWorkloopMap: {},

  events: new EventEmitter(),
  ...props,
});

test('workloop can be cancelled', async (t) => {
  let count = 0;
  currentWorkloop = createMockWorkloop();

  const app = createMockApp({
    queueChannel: mockChannel({
      [CLAIM]: () => {
        count++;
        currentWorkloop.stop();
        return { runs: [] };
      },
    }),
  });

  startWorkloop(app as any, logger, 1, 1, currentWorkloop);
  t.false(currentWorkloop.isStopped());

  await sleep(100);
  // A quirk of how cancel works is that the loop will be called a few times
  t.true(count <= 5);
  t.true(currentWorkloop.isStopped());
});

test('workloop sends the runs:claim event', (t) => {
  return new Promise((done) => {
    currentWorkloop = createMockWorkloop();
    const app = createMockApp({
      queueChannel: mockChannel({
        [CLAIM]: () => {
          t.pass();
          done();
          return { runs: [] };
        },
      }),
    });
    startWorkloop(app as any, logger, 1, 1, currentWorkloop);
  });
});

test('workloop sends the runs:claim event several times ', (t) => {
  return new Promise((done) => {
    let count = 0;
    currentWorkloop = createMockWorkloop();
    const app = createMockApp({
      queueChannel: mockChannel({
        [CLAIM]: () => {
          count++;
          if (count === 5) {
            t.pass();
            done();
          }
          return { runs: [] };
        },
      }),
    });
    startWorkloop(app as any, logger, 1, 1, currentWorkloop);
  });
});

test('workloop calls execute if runs:claim returns runs', (t) => {
  return new Promise((done) => {
    currentWorkloop = createMockWorkloop();
    const app = createMockApp({
      queueChannel: mockChannel({
        [CLAIM]: () => ({
          runs: [{ id: 'a', token: 'x.y.z' }],
        }),
      }),
      execute: (run: any) => {
        t.deepEqual(run, { id: 'a', token: 'x.y.z' });
        t.pass();
        done();
      },
    });

    startWorkloop(app as any, logger, 1, 1, currentWorkloop);
  });
});

test('startWorkloop overwrites stop/isStopped on the workloop', (t) => {
  return new Promise((done) => {
    currentWorkloop = createMockWorkloop();
    // Before starting, isStopped returns true (stub)
    t.true(currentWorkloop.isStopped());

    const app = createMockApp({
      queueChannel: mockChannel({
        [CLAIM]: () => {
          // After starting, isStopped returns false (real closure)
          t.false(currentWorkloop.isStopped());
          t.pass();
          done();
          return { runs: [] };
        },
      }),
    });
    startWorkloop(app as any, logger, 1, 1, currentWorkloop);
  });
});

test('stopping one workloop does not affect another', async (t) => {
  const wlA = createMockWorkloop(1);
  const wlB = createMockWorkloop(1);

  let countB = 0;

  const appA = createMockApp({
    queueChannel: mockChannel({
      [CLAIM]: () => {
        return { runs: [] };
      },
    }),
  });

  const appB = createMockApp({
    queueChannel: mockChannel({
      [CLAIM]: () => {
        countB++;
        return { runs: [] };
      },
    }),
  });

  startWorkloop(appA as any, logger, 1, 1, wlA);
  startWorkloop(appB as any, logger, 1, 1, wlB);

  await sleep(50);
  wlA.stop();
  const countBAtAStop = countB;
  await sleep(50);

  // Workloop A should be stopped
  t.true(wlA.isStopped());
  // Workloop B should still be running and claiming
  t.false(wlB.isStopped());
  t.true(countB > countBAtAStop);

  wlB.stop();
});
