import test from 'ava';
import path from 'node:path';

import createEngine, { EngineOptions } from '../src/engine';
import { createMockLogger } from '@openfn/logger';
import { WORKFLOW_COMPLETE, WORKFLOW_ERROR } from '../src/events';

let engine;

test.before(async () => {
  const logger = createMockLogger('', { level: 'debug' });

  const options: EngineOptions = {
    logger,
    repoDir: path.resolve('./test/__repo__'),
    autoinstall: {
      // disable autoinstall
      handleIsInstalled: async () => true,
    },
    maxWorkers: 1,
    memoryLimitMb: 200,
  };

  // This uses the real runtime and real worker
  engine = await createEngine(options);
});

// This should exit gracefully with a compile error
test.serial('syntax error: missing bracket', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'a',
      jobs: [
        {
          id: 'x',
          // This is subtle syntax error
          expression: 'fn((s) => { return s )',
        },
      ],
    };

    engine.execute(plan).on(WORKFLOW_ERROR, (evt) => {
      t.is(evt.type, 'CompileError');
      // compilation happens in the main thread
      t.is(evt.threadId, '-');
      t.is(evt.message, 'x: Unexpected token (1:21)');
      done();
    });
  });
});

test.serial('syntax error: illegal throw', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'b',
      jobs: [
        {
          id: 'z',
          // This is also subtle syntax error
          expression: 'fn(() => throw "e")',
        },
      ],
    };

    engine.execute(plan).on(WORKFLOW_ERROR, (evt) => {
      t.is(evt.type, 'CompileError');
      // compilation happens in the main thread
      t.is(evt.threadId, '-');
      t.is(evt.message, 'z: Unexpected token (1:9)');
      done();
    });
  });
});

test.serial('thread oom error', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'a',
      jobs: [
        {
          expression: `export default [(s) => {
              s.a = [];
              while(true) {
                s.a.push(new Array(1e6).fill("oom"));
              }
              return s;
            }]`,
        },
      ],
    };

    engine.execute(plan).on(WORKFLOW_ERROR, (evt) => {
      t.is(evt.type, 'OOMError');
      t.is(evt.severity, 'kill');
      t.is(evt.message, 'Run exceeded maximum memory usage');
      done();
    });
  });
});

test.serial('vm oom error', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'a',
      jobs: [
        {
          expression: `export default [(s) => {
              s.a = [];
              while(true) {
                s.a.push(new Array(1e9).fill("oom"));
              }
              return s;
            }]`,
        },
      ],
    };

    engine.execute(plan).on(WORKFLOW_ERROR, (evt) => {
      console.log(evt);
      t.is(evt.type, 'OOMError');
      t.is(evt.severity, 'kill');
      t.is(evt.message, 'Run exceeded maximum memory usage');
      done();
    });
  });
});

// https://github.com/OpenFn/kit/issues/509
// TODO this passes standalone, but will trigger an exception in the next test
// This should start working again once we spin up the worker thread
test.serial.skip('execution error from async code', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'a',
      jobs: [
        {
          // this error will throw within the promise, and so before the job completes
          // But REALLY naughty code could throw after the job has finished
          // In which case it'll be ignored
          // Also note that the wrapping promise will never resolve
          expression: `export default [(s) => new Promise((r) => {
            setTimeout(() => { throw new Error(\"e1324\"); r() }, 10)
            })]`,
        },
      ],
    };

    engine.execute(plan).on(WORKFLOW_ERROR, (evt) => {
      t.is(evt.type, 'ExecutionError');
      t.is(evt.severity, 'crash');

      done();
    });
  });
});

test.serial('emit a crash error on process.exit()', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'z',
      jobs: [
        {
          adaptor: 'helper@1.0.0',
          expression: 'export default [exit()]',
        },
      ],
    };

    engine.execute(plan).on(WORKFLOW_ERROR, (evt) => {
      t.is(evt.type, 'ExitError');
      t.is(evt.severity, 'crash');
      t.is(evt.message, 'Process exited with code: 42');
      done();
    });
  });
});
