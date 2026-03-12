import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import { sleep } from '../util';
import { mockChannel } from '../../src/mock/sockets';
import { Workloop } from '../../src/api/workloop';
import { CLAIM } from '../../src/events';
import EventEmitter from 'node:events';

let workloop: Workloop | undefined;

const logger = createMockLogger();

test.afterEach(() => {
  workloop?.stop();
  workloop = undefined;
});

const createWorkloop = (capacity = 5) =>
  new Workloop({
    id: `manual>*:${capacity}`,
    queues: ['manual', '*'],
    capacity,
  });

const createMockApp = (props: any) => ({
  workflows: {},
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

test.serial('workloop can be cancelled', async (t) => {
  let count = 0;
  workloop = createWorkloop();

  const app = createMockApp({
    queueChannel: mockChannel({
      [CLAIM]: () => {
        count++;
        workloop?.stop();
        return { runs: [] };
      },
    }),
  });

  workloop.start(app as any, logger, 1, 1);
  t.false(workloop.isStopped());

  await sleep(100);
  // A quirk of how cancel works is that the loop will be called a few times
  t.true(count <= 5);
  t.true(workloop.isStopped());
});

test.serial('workloop sends the runs:claim event', (t) => {
  return new Promise((done) => {
    workloop = createWorkloop();
    const app = createMockApp({
      queueChannel: mockChannel({
        [CLAIM]: () => {
          t.pass();
          done();
          return { runs: [] };
        },
      }),
    });
    workloop.start(app as any, logger, 1, 1);
  });
});

test.serial('workloop sends the runs:claim event several times ', (t) => {
  return new Promise((done) => {
    let count = 0;
    workloop = createWorkloop();
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
    workloop.start(app as any, logger, 1, 1);
  });
});

test.serial('workloop calls execute if runs:claim returns runs', (t) => {
  return new Promise((done) => {
    workloop = createWorkloop();
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

    workloop.start(app as any, logger, 1, 1);
  });
});

test.serial('workloop has stop and isStopped methods', (t) => {
  return new Promise((done) => {
    workloop = createWorkloop();

    const app = createMockApp({
      queueChannel: mockChannel({
        [CLAIM]: () => {
          t.false(workloop?.isStopped());
          t.pass();
          done();
          return { runs: [] };
        },
      }),
    });
    workloop.start(app as any, logger, 1, 1);

    t.is(typeof workloop.stop, 'function');
    t.is(typeof workloop.isStopped, 'function');
  });
});

test.serial('stopping one workloop does not affect another', async (t) => {
  const wlA = createWorkloop(1);
  const wlB = createWorkloop(1);

  let countB = 0;

  const appA = createMockApp({
    queueChannel: mockChannel({
      [CLAIM]: () => ({ runs: [] }),
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

  wlA.start(appA as any, logger, 1, 1);
  wlB.start(appB as any, logger, 1, 1);

  await sleep(50);
  wlA.stop();
  const countBAtAStop = countB;
  await sleep(50);

  t.true(wlA.isStopped());
  t.false(wlB.isStopped());
  t.true(countB > countBAtAStop);

  wlB.stop();
});

test.serial('hasCapacity: has capacity when empty', (t) => {
  workloop = createWorkloop(3);
  t.true(workloop.hasCapacity());
});

test.serial('hasCapacity: has capacity when partially filled', (t) => {
  workloop = createWorkloop(3);
  workloop.activeRuns.add('run-1');
  t.true(workloop.hasCapacity());
});

test.serial('hasCapacity: no capacity when activeRuns fills capacity', (t) => {
  workloop = createWorkloop(2);
  workloop.activeRuns.add('run-1');
  workloop.activeRuns.add('run-2');
  t.false(workloop.hasCapacity());
});

test.serial(
  'hasCapacity: no capacity when pendingClaims fills capacity',
  (t) => {
    workloop = createWorkloop(2);
    workloop.openClaims['claim-a'] = 2;
    t.false(workloop.hasCapacity());
  }
);

test.serial(
  'hasCapacity: no capacity when activeRuns + pendingClaims fills capacity',
  (t) => {
    workloop = createWorkloop(3);
    workloop.activeRuns.add('run-1');
    workloop.openClaims['claim-a'] = 1;
    workloop.openClaims['claim-b'] = 1;
    t.false(workloop.hasCapacity());
  }
);
