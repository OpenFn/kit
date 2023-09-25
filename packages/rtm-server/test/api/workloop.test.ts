import test from 'ava';
import { mockChannel, sleep } from '../util';

import startWorkloop from '../../src/api/workloop';
import { CLAIM } from '../../src/events';

let cancel;

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
    },
  });

  cancel = startWorkloop(channel, () => {}, 1);

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
      },
    });
    cancel = startWorkloop(channel, () => {});
  });
});

test.only('workloop sends the attempts:claim event several times ', (t) => {
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
      },
    });
    cancel = startWorkloop(channel, () => {});
  });
});

test('workloop calls execute if attempts:claim returns attempts', (t) => {
  return new Promise((done) => {
    let cancel;
    const channel = mockChannel({
      [CLAIM]: () => {
        return [{ id: 'a' }];
      },
    });

    cancel = startWorkloop(channel, (attempt) => {
      t.deepEqual(attempt, { id: 'a' });
      t.pass();
      done();
    });
  });
});
