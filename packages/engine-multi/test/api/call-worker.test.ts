import test from 'ava';
import path from 'node:path';
import EventEmitter from 'node:events';
import { createMockLogger } from '@openfn/logger';

import initWorkers from '../../src/api/call-worker';
import { EngineAPI } from '../../src/types';

let engine = new EventEmitter() as EngineAPI;

const workerPath = path.resolve('dist/test/worker-functions.js');
const logger = createMockLogger();

test.before(() => {
  const { callWorker, closeWorkers } = initWorkers(
    workerPath,
    {
      maxWorkers: 1,
    },
    logger
  );
  engine.callWorker = callWorker;
  engine.closeWorkers = closeWorkers;
});

test.after(() => engine.closeWorkers());

test.serial('initWorkers should add a callWorker function', (t) => {
  t.assert(typeof engine.callWorker === 'function');
});

test.serial('callWorker should return the default result', async (t) => {
  const result = await engine.callWorker('test', []);
  t.is(result, 42);
});

test.serial('callWorker should return a custom result', async (t) => {
  const result = await engine.callWorker('test', [84]);
  t.is(result, 84);
});

test.serial('callWorker should trigger an event callback', async (t) => {
  const onCallback = ({ result }) => {
    t.is(result, 11);
  };

  await engine.callWorker('test', [11], { 'test-message': onCallback });
});

test.serial(
  'callWorker should throw TimeoutError if it times out',
  async (t) => {
    await t.throwsAsync(
      () => engine.callWorker('wait', [5000], {}, { timeout: 100 }),
      {
        name: 'TimeoutError',
      }
    );
  }
);

test.serial(
  'callWorker should not freak out after a timeout error',
  async (t) => {
    await t.throwsAsync(
      () => engine.callWorker('wait', [5000], {}, { timeout: 100 }),
      {
        name: 'TimeoutError',
      }
    );

    const onCallback = (evt) => {
      t.pass('all ok');
    };

    await engine.callWorker('test', [], { 'test-message': onCallback });
  }
);

test.serial('callWorker should execute in one process', async (t) => {
  const ids: number[] = [];

  await engine.callWorker('test', [], {
    'test-message': ({ processId }) => {
      ids.push(processId);
    },
  });

  await engine.callWorker('test', [], {
    'test-message': ({ processId }) => {
      ids.push(processId);
    },
  });

  t.log(ids);
  t.is(ids[0], ids[1]);
});

test.serial('callWorker should execute in two different threads', async (t) => {
  const ids: number[] = [];

  await engine.callWorker('test', [], {
    'test-message': ({ threadId }) => {
      ids.push(threadId);
    },
  });

  await engine.callWorker('test', [], {
    'test-message': ({ threadId }) => {
      ids.push(threadId);
    },
  });

  t.log(ids);
  t.not(ids[0], ids[1]);
});

test.serial(
  'Even if null env is passed, worker thread should not be able to access parent env',
  async (t) => {
    const env = null;
    const { callWorker, closeWorkers } = initWorkers(
      workerPath,
      {
        env,
      },
      logger
    );

    // Set up a special key on process.env
    const code = '76ytghjs';
    process.env.TEST = code;

    // try and read that key inside the thread
    const result = await callWorker('readEnv', ['TEST']);

    // Sorry pal, no dice
    t.not(result, code);

    closeWorkers();
  }
);

test.serial(
  'By default, worker thread cannot access parent env if env not set (no options arg)',
  async (t) => {
    const { callWorker, closeWorkers } = initWorkers(
      workerPath,
      undefined,
      logger
    );

    // Set up a special key on process.env
    const code = '76ytghjs';
    process.env.TEST = code;

    // try and read that key inside the thread
    const result = await callWorker('readEnv', ['TEST']);

    // No fish
    t.is(result, undefined);

    closeWorkers();
  }
);

test.serial(
  'By default, worker thread cannot access parent env if env not set (with options arg)',
  async (t) => {
    const defaultAPI = {} as EngineAPI;

    const { callWorker, closeWorkers } = initWorkers(
      workerPath,
      { maxWorkers: 1 },
      logger
    );

    // Set up a special key on process.env
    const code = '76ytghjs';
    process.env.TEST = code;

    // try and read that key inside the thread
    const result = await callWorker('readEnv', ['TEST']);

    // No fish
    t.is(result, undefined);

    closeWorkers();
  }
);

test.serial(
  'Worker thread cannot access parent env if custom env is passted',
  async (t) => {
    const env = { NODE_ENV: 'production' };
    const { callWorker, closeWorkers } = initWorkers(
      workerPath,
      { env },
      logger
    );

    // Set up a special key on process.env
    const code = '76ytghjs';
    process.env.TEST = code;

    // try and read that key inside the thread
    const result = await callWorker('readEnv', ['TEST']);

    // No fish
    t.is(result, undefined);

    const result2 = await callWorker('readEnv', ['NODE_ENV']);
    t.is(result2, 'production');

    closeWorkers();
  }
);
