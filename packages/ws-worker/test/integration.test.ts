/*
 * Tests of Lightning-RTM server integration, from Lightning's perspective
 */

import test from 'ava';
import createRTMServer from '../src/server';
import createLightningServer from '../src/mock/lightning';
import createMockRTM from '../src/mock/runtime-manager';

import { wait, waitForEvent } from './util';

let lng;
let rtm;

const urls = {
  rtm: 'http://localhost:4567',
  lng: 'http://localhost:7654',
};

test.before(() => {
  lng = createLightningServer({ port: 7654 });
  rtm = createRTMServer(createMockRTM('rtm'), {
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
