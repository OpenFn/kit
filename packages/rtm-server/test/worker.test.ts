import test from 'ava';
import { GET_ATTEMPT } from '../src/events';
import { prepareAttempt } from '../src/worker';
import { attempts } from './mock/data';

// This is a fake/mock websocket used by mocks

const mockChannel = (callbacks) => {
  return {
    push: (event: string, payload: any) => {
      // if a callback was registered, trigger it
      // otherwise do nothing

      let result;
      if (callbacks[event]) {
        result = callbacks[event](payload);
      }

      return {
        receive: (status, callback) => {
          // TODO maybe do this asynchronously?
          callback(result);
        },
      };
    },
  };
};

test('mock channel: should invoke handler with payload', (t) => {
  return new Promise((done) => {
    const channel = mockChannel({
      ping: (evt) => {
        t.is(evt, 'abc');
        t.pass();
        done();
      },
    });

    channel.push('ping', 'abc');
  });
});

test('mock channel: invoke the ok handler with the callback result', (t) => {
  return new Promise((done) => {
    const channel = mockChannel({
      ping: () => {
        return 'pong!';
      },
    });

    channel.push('ping', 'abc').receive('ok', (evt) => {
      t.is(evt, 'pong!');
      t.pass();
      done();
    });
  });
});

// TODO throw in the handler to get an error?

test('prepareAttempt should get the attempt body', async (t) => {
  const attempt = attempts['attempt-1'];
  let didCallGetAttempt = false;
  const channel = mockChannel({
    [GET_ATTEMPT]: () => {
      // TODO should be no payload (or empty payload)
      didCallGetAttempt = true;
    },
  });

  await prepareAttempt(channel, 'a1');
  t.true(didCallGetAttempt);
});

test('prepareAttempt should return an execution plan', async (t) => {
  const attempt = attempts['attempt-1'];

  const channel = mockChannel({
    [GET_ATTEMPT]: () => attempt,
  });

  const plan = await prepareAttempt(channel, 'a1');
  t.deepEqual(plan, {
    id: 'attempt-1',
    jobs: [
      {
        id: 'trigger',
        configuration: 'a',
        expression: 'fn(a => a)',
        adaptor: '@openfn/language-common@1.0.0',
      },
    ],
  });
});

test.skip('jobStart should emit the run id', () => {});

// TODO test the whole execute workflow
