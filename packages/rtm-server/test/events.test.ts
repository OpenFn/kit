/**
 * Unit tests on events published by the rtm-server
 * No lightning involved here
 */
import test from 'ava';
import createRTMServer from '../src/server';
import createMockRTM from '../src/mock/runtime-manager';
import { waitForEvent } from './util';

const str = (obj: object) => JSON.stringify(obj);

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

    // TODO what goes in this event?
    // Test more carefully
  }
);

test.serial.only(
  'trigger a workflow-complete event when execution completes',
  async (t) => {
    server.execute({
      id: 'a',
      triggers: [{ id: 't', next: { b: true } }],
      jobs: [{ id: 'j', body: str({ answer: 42 }) }],
    });

    const evt = await waitForEvent(server, 'workflow-complete');
    t.truthy(evt);
    t.is(evt.id, 'a');
    t.deepEqual(evt.state, { answer: 42 });
  }
);
