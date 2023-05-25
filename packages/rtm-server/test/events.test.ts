/**
 * Unit tests on events published by the rtm-server
 * No lightning involved here
 */
import test from 'ava';
import createRTMServer from '../src/server';
import createMockRTM from '../src/mock/runtime-manager';
import { waitForEvent } from './util';

let server;

test.before(() => {
  const rtm = createMockRTM();
  server = createRTMServer(rtm, { port: 2626 });
});

test.serial(
  'trigger a workflow-start event when execution starts',
  async (t) => {
    server.execute({
      id: 'a',
      triggers: [{ id: 't', next: { b: true } }],
      jobs: [{ id: 'j' }],
    });

    const evt = await waitForEvent(server, 'workflow-start');
    t.truthy(evt);
    t.is(evt.id, 'a');
  }
);

test.serial.skip('should pick up a novel attempt in the queue', async (t) => {
  lng.addToQueue({ id: 'x', plan: [{ expression: '{}' }] });
  const evt = await waitForEvent(rtm, 'workflow-start');
  t.truthy(evt);
  t.is(evt.id, 'x');

  // let the workflow finish processing
  await waitForEvent(rtm, 'workflow-complete');
});

test.serial.skip(
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
