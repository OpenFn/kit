/*
 * Tests of Lightning-Engine server integration, from Lightning's perspective
 */

import test from 'ava';
import createWorkerServer from '../src/server';
import createLightningServer from '../src/mock/lightning';
import createMockRTE from '../src/mock/runtime-engine';

let lng;
let engine;

const urls = {
  engine: 'http://localhost:4567',
  lng: 'http://localhost:7654',
};

test.before(() => {
  lng = createLightningServer({ port: 7654 });
  engine = createWorkerServer(createMockRTE('engine'), {
    port: 4567,
    lightning: urls.lng,
  });
});

// Really high level test
test.serial.skip('process an attempt', async (t) => {
  lng.enqueueAttempt({
    id: 'a1',
    jobs: [
      {
        adaptor: '@openfn/language-common@1.0.0',
        body: JSON.stringify({ answer: 42 }),
      },
    ],
  });

  const { state } = await lng.waitForResult('a1');
  t.is(state.answer, 42);
});
