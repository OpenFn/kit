/**
 * Simple suite of unit tests against the mock worker API
 * Passes state in and expects the mock worker to behave as instructed
 * Ie return a value, timeout, throw
 * 
 * This file exercises the actual mock function, not the helper API
 * TODO so I suppose it should text the mock itself, not the worker-wrapped one
 */
import path from 'node:path';
import test from 'ava';
import workerpool from 'workerpool';

const workers = workerpool.pool(path.resolve('dist/mock-worker.js'));

const jobid = 1;
const src = "mock";

test('return a default value', async (t) => {
  const state = {};
  const result = await workers.exec('run', [jobid, src, state]);
  t.assert(result == 42);
});

test('return a simple value', async (t) => {
  const state = {
    returnValue: 10
  };
  const result = await workers.exec('run', [jobid, src, state]);
  t.assert(result == 10);
});

// should throw

// should return after a timeout

// should throw after a timeout