import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import { sleep } from '../util';
import { mockChannel } from '../../src/mock/sockets';
import startWorkloop from '../../src/api/workloop';
import { CLAIM } from '../../src/events';
import EventEmitter from 'node:events';

let workloop: any;

const logger = createMockLogger();

test.afterEach(() => {
  workloop?.stop(); // cancel any workloops
});

const createMockApp = (props: any) => ({
  workflows: {},
  queueChannel: mockChannel({
    [CLAIM]: () => {
      return { runs: [] };
    },
  }),
  execute: () => {},

  events: new EventEmitter(),
  ...props,
});

test('workloop can be cancelled', async (t) => {
  let count = 0;

  const app = createMockApp({
    queueChannel: mockChannel({
      [CLAIM]: () => {
        count++;
        workloop.stop();
        return { runs: [] };
      },
    }),
  });

  workloop = startWorkloop(app as any, logger, 1, 1);
  t.false(workloop.isStopped());

  await sleep(100);
  // A quirk of how cancel works is that the loop will be called a few times
  t.true(count <= 5);
  t.true(workloop.isStopped());
});

test('workloop sends the runs:claim event', (t) => {
  return new Promise((done) => {
    const app = createMockApp({
      queueChannel: mockChannel({
        [CLAIM]: () => {
          t.pass();
          done();
          return { runs: [] };
        },
      }),
    });
    workloop = startWorkloop(app as any, logger, 1, 1);
  });
});

test('workloop sends the runs:claim event several times ', (t) => {
  return new Promise((done) => {
    let count = 0;
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
    workloop = startWorkloop(app as any, logger, 1, 1);
  });
});

test('workloop calls execute if runs:claim returns runs', (t) => {
  return new Promise((done) => {
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

    workloop = startWorkloop(app as any, logger, 1, 1);
  });
});
