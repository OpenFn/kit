// these integration tests test the realy rtm server logic with a mock lightning and a mock rtm
// So maybe it's not really "integration" tests after all, but regular server tests
import test from 'ava';
import axios from 'axios';
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

test.serial('should pick up a default attempt in the queue', async (t) => {
  lng.addToQueue('attempt-1');
  const evt = await waitForEvent(rtm, 'workflow-start');
  t.truthy(evt);
  t.is(evt.id, 'attempt-1');
});

test.serial('should pick up a novel attempt in the queue', async (t) => {
  lng.addToQueue({ id: 'x', plan: [{ expression: '{}' }] });
  const evt = await waitForEvent(rtm, 'workflow-start');
  t.truthy(evt);
  t.is(evt.id, 'x');

  // let the workflow finish processing
  await waitForEvent(rtm, 'workflow-complete');
});

test.serial(
  'should publish a workflow-complete event with state',
  async (t) => {
    // The mock RTM will evaluate the expression as JSON and return it
    lng.addToQueue({ id: 'x', plan: [{ expression: '{ "answer": 42 }' }] });

    const evt = await waitForEvent(rtm, 'workflow-complete');
    t.truthy(evt);
    t.is(evt.id, 'x');
    t.deepEqual(evt.state, { answer: 42 });
  }
);

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
