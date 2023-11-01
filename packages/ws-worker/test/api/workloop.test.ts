import test from 'ava';

import { sleep } from '../util';

import { mockChannel } from '../../src/mock/sockets';
import startWorkloop from '../../src/api/workloop';
import { CLAIM } from '../../src/events';
import { createMockLogger } from '@openfn/logger';
import { execute } from '../../src/api/execute';

let cancel;

const logger = createMockLogger();

test.afterEach(() => {
  cancel?.(); // cancel any workloops
});

test('workloop can be cancelled', async (t) => {
  let count = 0;
  let cancel;
  const channel = mockChannel({
    [CLAIM]: () => {
      count++;
      cancel();
      return { attempts: [] };
    },
  });

  cancel = startWorkloop(channel, () => {}, logger, { timeout: 1 });

  await sleep(100);
  // A quirk of how cancel works is that the loop will be called a few times
  t.assert(count <= 5);
});

test('workloop sends the attempts:claim event', (t) => {
  return new Promise((done) => {
    let cancel;
    const channel = mockChannel({
      [CLAIM]: () => {
        t.pass();
        done();
        return { attempts: [] };
      },
    });
    cancel = startWorkloop(channel, () => {}, logger);
  });
});

test('workloop sends the attempts:claim event several times ', (t) => {
  return new Promise((done) => {
    let cancel;
    let count = 0;
    const channel = mockChannel({
      [CLAIM]: () => {
        count++;
        if (count === 5) {
          t.pass();
          done();
        }
        return { attempts: [] };
      },
    });
    cancel = startWorkloop(channel, () => {}, logger);
  });
});

test('workloop calls execute if attempts:claim returns attempts', (t) => {
  return new Promise((done) => {
    let cancel;
    const channel = mockChannel({
      [CLAIM]: () => ({
        attempts: [{ id: 'a', token: 'x.y.z' }],
      }),
    });

    const execute = (attempt) => {
      t.deepEqual(attempt, { id: 'a', token: 'x.y.z' });
      t.pass();
      done();
    };
    cancel = startWorkloop(channel, execute, logger);
  });
});
