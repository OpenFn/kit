import test from 'ava';
import create from '../src/mock';

const wait = (fn, maxAttempts = 100) =>
  new Promise((resolve) => {
    let count = 0;
    let ival = setInterval(() => {
      count++;
      if (fn()) {
        clearInterval(ival);
        resolve(true);
      }

      if (count == maxAttempts) {
        clearInterval(ival);
        resolve(false);
      }
    }, 100);
  });

test('It should create a mock runtime manager', (t) => {
  const rtm = create();
  const keys = Object.keys(rtm);
  t.assert(keys.includes('on'));
  t.assert(keys.includes('startWorkflow'));
  t.assert(keys.includes('startJob'));
  t.assert(keys.includes('getStatus'));
});

test('it should dispatch job-start events', async (t) => {
  const rtm = create();

  let evt;

  rtm.on('job-start', (e) => {
    evt = e;
  });

  rtm.startJob('a');

  const didFire = await wait(() => evt);
  t.true(didFire);
  t.is(evt.jobId, 'a');
  t.truthy(evt.runId);
});

test('it should dispatch job-log events', async (t) => {
  const rtm = create();

  let evt;

  rtm.on('job-log', (e) => {
    evt = e;
  });

  rtm.startJob('a');

  const didFire = await wait(() => evt);

  t.true(didFire);
  t.is(evt.jobId, 'a');
  t.truthy(evt.runId);
});

test('it should dispatch job-end events', async (t) => {
  const rtm = create();

  let evt;

  rtm.on('job-end', (e) => {
    evt = e;
  });

  rtm.startJob('a');

  const didFire = await wait(() => evt);

  t.true(didFire);
  t.is(evt.jobId, 'a');
  t.truthy(evt.runId);
  t.truthy(evt.state);
});

test('it should mock job state', async (t) => {
  const rtm = create();

  const result = 42;

  rtm._setJobResult('a', result);
  let evt;

  rtm.on('job-end', (e) => {
    evt = e;
  });

  rtm.startJob('a');

  const didFire = await wait(() => evt);

  t.true(didFire);
  t.is(evt.jobId, 'a');
  t.truthy(evt.runId);
  t.is(evt.state, result);
});
