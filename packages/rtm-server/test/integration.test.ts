/*
 * Tests of Lightning-RTM server integration, from Lightning's perspective
 */

import test from 'ava';
import createRTMServer from '../src/server';
import createLightningServer from '../src/mock/lightning';

import { wait, waitForEvent } from './util';

let lng;
let rtm;

const urls = {
  rtm: 'http://localhost:4567',
  lng: 'http://localhost:7654',
};

test.before(() => {
  lng = createLightningServer({ port: 7654 });
  rtm = createRTMServer({ port: 4567, lightning: urls.lng });
});

// Really high level test
test.serial('process an attempt', async (t) => {
  lng.addAttempt('a1', {
    // workflow goes here
  });

  lng.waitForResult('a1', (result) => {
    // test the result here
    t.is(result.answer, 42);
  });
});

// process multple attempts

test.serial(
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
