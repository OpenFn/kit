import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import { sleep } from '../util';
import { mockChannel } from '../../src/mock/sockets';
import startWorkloop, {
  createWorkloop,
  Workloop,
  WorkloopHandle,
  workloopHasCapacity,
} from '../../src/api/workloop';
import { CLAIM } from '../../src/events';
import EventEmitter from 'node:events';

let currentHandle: WorkloopHandle | undefined;

const logger = createMockLogger();

test.afterEach(() => {
  currentHandle?.stop(); // cancel any workloops
  currentHandle = undefined;
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
  const workloop = createMockWorkloop();
  let handle: WorkloopHandle;

  const app = createMockApp({
    queueChannel: mockChannel({
      [CLAIM]: () => {
        count++;
        handle.stop();
        return { runs: [] };
      },
    }),
  });

  handle = startWorkloop(app as any, logger, 1, 1, workloop);
  currentHandle = handle;
  t.false(handle.isStopped());

  await sleep(100);
  // A quirk of how cancel works is that the loop will be called a few times
  t.true(count <= 5);
  t.true(handle.isStopped());
});

test('workloop sends the runs:claim event', (t) => {
  return new Promise((done) => {
    const workloop = createMockWorkloop();
    const app = createMockApp({
      queueChannel: mockChannel({
        [CLAIM]: () => {
          t.pass();
          done();
          return { runs: [] };
        },
      }),
    });
    currentHandle = startWorkloop(app as any, logger, 1, 1, workloop);
  });
});

test('workloop sends the runs:claim event several times ', (t) => {
  return new Promise((done) => {
    let count = 0;
    const workloop = createMockWorkloop();
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
    currentHandle = startWorkloop(app as any, logger, 1, 1, workloop);
  });
});

test('workloop calls execute if runs:claim returns runs', (t) => {
  return new Promise((done) => {
    const workloop = createMockWorkloop();
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

    currentHandle = startWorkloop(app as any, logger, 1, 1, workloop);
  });
});

test('startWorkloop returns a handle with stop and isStopped', (t) => {
  return new Promise((done) => {
    const workloop = createMockWorkloop();

    const app = createMockApp({
      queueChannel: mockChannel({
        [CLAIM]: () => {
          // After starting, isStopped returns false
          t.false(handle.isStopped());
          t.pass();
          done();
          return { runs: [] };
        },
      }),
    });
    const handle = startWorkloop(app as any, logger, 1, 1, workloop);
    currentHandle = handle;

    // Handle has the right shape
    t.is(typeof handle.stop, 'function');
    t.is(typeof handle.isStopped, 'function');
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

  const handleA = startWorkloop(appA as any, logger, 1, 1, wlA);
  const handleB = startWorkloop(appB as any, logger, 1, 1, wlB);

  await sleep(50);
  handleA.stop();
  const countBAtAStop = countB;
  await sleep(50);

  // Workloop A should be stopped
  t.true(handleA.isStopped());
  // Workloop B should still be running and claiming
  t.false(handleB.isStopped());
  t.true(countB > countBAtAStop);

  handleB.stop();
});

// createWorkloop tests

test('createWorkloop: generates correct id', (t) => {
  const workloop = createWorkloop({ queues: ['fast_lane'], capacity: 1 });
  t.is(workloop.id, 'fast_lane:1');
});

test('createWorkloop: generates id with multiple queues', (t) => {
  const workloop = createWorkloop({ queues: ['manual', '*'], capacity: 4 });
  t.is(workloop.id, 'manual>*:4');
});

test('createWorkloop: initializes empty activeRuns', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 5 });
  t.is(workloop.activeRuns.size, 0);
});

test('createWorkloop: initializes empty openClaims', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 5 });
  t.deepEqual(workloop.openClaims, {});
});

test('createWorkloop: preserves queues and capacity', (t) => {
  const workloop = createWorkloop({ queues: ['a', 'b', '*'], capacity: 3 });
  t.deepEqual(workloop.queues, ['a', 'b', '*']);
  t.is(workloop.capacity, 3);
});

// workloopHasCapacity tests

test('workloopHasCapacity: has capacity when empty', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 3 });
  t.true(workloopHasCapacity(workloop));
});

test('workloopHasCapacity: has capacity when partially filled', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 3 });
  workloop.activeRuns.add('run-1');
  t.true(workloopHasCapacity(workloop));
});

test('workloopHasCapacity: no capacity when activeRuns fills capacity', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 2 });
  workloop.activeRuns.add('run-1');
  workloop.activeRuns.add('run-2');
  t.false(workloopHasCapacity(workloop));
});

test('workloopHasCapacity: no capacity when pendingClaims fills capacity', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 2 });
  workloop.openClaims['claim-a'] = 2;
  t.false(workloopHasCapacity(workloop));
});

test('workloopHasCapacity: no capacity when activeRuns + pendingClaims fills capacity', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 3 });
  workloop.activeRuns.add('run-1');
  workloop.openClaims['claim-a'] = 1;
  workloop.openClaims['claim-b'] = 1;
  t.false(workloopHasCapacity(workloop));
});
