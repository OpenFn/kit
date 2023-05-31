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
test.serial('process an attempt', async (t) => {
  lng.addToQueue({
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

// process multiple attempts

test.serial.skip(
  'should post to attempts/complete with the final state',
  async (t) => {
    // The mock RTM will evaluate the expression as JSON and return it
    lng.addToQueue({ id: 'y', plan: [{ expression: '{ "answer": 42 }' }] });

    await waitForEvent(rtm, 'workflow-complete');

    // The RMT server will post to attempts/complete/:id with the state, which should eventually
    // be available to our little debug API here
    const result = await wait(() => lng.getResult('y'));
    t.truthy(result);
    t.is(result.answer, 42);
  }
);
