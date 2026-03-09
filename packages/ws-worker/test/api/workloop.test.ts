import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import { sleep } from '../util';
import { mockChannel } from '../../src/mock/sockets';
import startWorkloop from '../../src/api/workloop';
import { CLAIM } from '../../src/events';
import EventEmitter from 'node:events';
import { createRuntimeGroup, RuntimeSlotGroup } from '../../src/util/parse-queues';

let workloop: any;

const logger = createMockLogger();

test.afterEach(() => {
  workloop?.stop(); // cancel any workloops
});

const createMockGroup = (maxSlots = 5): RuntimeSlotGroup =>
  createRuntimeGroup({ queues: ['manual', '*'], maxSlots });

const createMockApp = (props: any) => ({
  workflows: {},
  openClaims: {},
  queueChannel: mockChannel({
    [CLAIM]: () => {
      return { runs: [] };
    },
  }),
  execute: () => {},
  runGroupMap: {},

  events: new EventEmitter(),
  ...props,
});

test('workloop can be cancelled', async (t) => {
  let count = 0;
  const group = createMockGroup();

  const app = createMockApp({
    queueChannel: mockChannel({
      [CLAIM]: () => {
        count++;
        workloop.stop();
        return { runs: [] };
      },
    }),
  });

  workloop = startWorkloop(app as any, logger, 1, 1, group);
  t.false(workloop.isStopped());

  await sleep(100);
  // A quirk of how cancel works is that the loop will be called a few times
  t.true(count <= 5);
  t.true(workloop.isStopped());
});

test('workloop sends the runs:claim event', (t) => {
  return new Promise((done) => {
    const group = createMockGroup();
    const app = createMockApp({
      queueChannel: mockChannel({
        [CLAIM]: () => {
          t.pass();
          done();
          return { runs: [] };
        },
      }),
    });
    workloop = startWorkloop(app as any, logger, 1, 1, group);
  });
});

test('workloop sends the runs:claim event several times ', (t) => {
  return new Promise((done) => {
    let count = 0;
    const group = createMockGroup();
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
    workloop = startWorkloop(app as any, logger, 1, 1, group);
  });
});

test('workloop calls execute if runs:claim returns runs', (t) => {
  return new Promise((done) => {
    const group = createMockGroup();
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

    workloop = startWorkloop(app as any, logger, 1, 1, group);
  });
});

test('workloop stores itself on group.workloop', (t) => {
  return new Promise((done) => {
    const group = createMockGroup();
    const app = createMockApp({
      queueChannel: mockChannel({
        [CLAIM]: () => {
          t.is(group.workloop, workloop);
          t.pass();
          done();
          return { runs: [] };
        },
      }),
    });
    workloop = startWorkloop(app as any, logger, 1, 1, group);
  });
});

test('stopping one group workloop does not affect another', async (t) => {
  const groupA = createMockGroup(1);
  const groupB = createMockGroup(1);

  let countB = 0;

  const appA = createMockApp({
    queueChannel: mockChannel({
      [CLAIM]: () => { return { runs: [] }; },
    }),
  });

  const appB = createMockApp({
    queueChannel: mockChannel({
      [CLAIM]: () => { countB++; return { runs: [] }; },
    }),
  });

  const wlA = startWorkloop(appA as any, logger, 1, 1, groupA);
  const wlB = startWorkloop(appB as any, logger, 1, 1, groupB);

  await sleep(50);
  wlA.stop();
  const countBAtAStop = countB;
  await sleep(50);

  // Group A should be stopped
  t.true(wlA.isStopped());
  // Group B should still be running and claiming
  t.false(wlB.isStopped());
  t.true(countB > countBAtAStop);

  wlB.stop();
});
