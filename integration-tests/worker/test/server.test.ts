import test from 'ava';

import { initLightning, initWorker } from '../src/init';

let lightning;
let worker;

test.afterEach(async () => {
  lightning.destroy();
  await worker.destroy();
});

let portgen = 3000;

const getPort = () => ++portgen;

test('should connect to lightning', (t) => {
  return new Promise(async (done) => {
    const port = getPort();
    lightning = initLightning(port);

    lightning.on('socket:connect', () => {
      t.pass('connection recieved');
      done();
    });

    ({ worker } = await initWorker(port));
  });
});

test('should join attempts queue channel', (t) => {
  return new Promise(async (done) => {
    const port = getPort();
    lightning = initLightning(port);

    lightning.on('socket:channel-join', ({ channel }) => {
      if (channel === 'worker:queue') {
        t.pass('joined channel');
        done();
      }
    });

    ({ worker } = await initWorker(port));
  });
});
