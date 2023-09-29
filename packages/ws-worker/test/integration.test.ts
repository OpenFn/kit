/*
 * Tests of Lightning-Engine server integration, from Lightning's perspective
 */

import test from 'ava';
import createWorkerServer from '../src/server';
import createLightningServer from '../src/mock/lightning';
import createMockRTE from '../src/mock/runtime-engine';
import * as e from '../src/events';

let lng;
let engine;

const urls = {
  engine: 'http://localhost:4567',
  lng: 'ws://localhost:7654/api',
};

test.before(() => {
  // TODO give lightning the same secret and do some validation
  lng = createLightningServer({ port: 7654 });
  engine = createWorkerServer(createMockRTE('engine'), {
    port: 4567,
    lightning: urls.lng,
    secret: 'abc',
  });
});

let rollingAttemptId = 0;

const getAttempt = (ext = {}, jobs = {}) => ({
  id: `a${++rollingAttemptId}`,
  jobs: jobs || [
    {
      adaptor: '@openfn/language-common@1.0.0',
      body: JSON.stringify({ answer: 42 }),
    },
  ],
  ...ext,
});

// A basic high level integration test to ensure the whole loop works
// This checks the events received by the lightning websocket
test.serial(
  'worker should pull an event from lightning, lightning should receive attempt-complete',
  (t) => {
    return new Promise((done) => {
      const attempt = getAttempt();
      lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
        // TODO we should validate the result event here, but it's not quite decided
        // I think it should be { attempt_id, dataclip_id }
        t.pass('attempt complete event received');
        done();
      });

      lng.enqueueAttempt(attempt);
    });
  }
);

// Now run detailed checks of every event
// for each event we can see a copy of the server state
// (if that helps anything?)

test.serial(`events: lightning should receive a ${e.CLAIM} event`, (t) => {
  return new Promise((done) => {
    const attempt = getAttempt();
    let didCallEvent = false;
    lng.onSocketEvent(e.CLAIM, attempt.id, ({ payload }) => {
      const { id, token } = payload;
      // Note that the payload here is what will be sent back to the worker
      // TODO check there's a token
      t.truthy(id);
      t.truthy(token);
      t.assert(typeof token === 'string');

      didCallEvent = true;
    });

    lng.onSocketEvent(e.ATTEMPT_COMPLETE, attempt.id, (evt) => {
      t.true(didCallEvent);
      done();
    });

    lng.enqueueAttempt(attempt);
  });
});

// should run multiple concurrently
