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

test.serial('syntax error: oom error', (t) => {
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
      done();
    });
  });
});

// https://github.com/OpenFn/kit/issues/509
test.serial('execution error from async code', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'a',
      jobs: [
        {
          expression: `export default [(s) => new Promise((r) => {
            // this error will throw within the promise, and so before the job completes
            // But REALLY naughty code could throw after the job has finished
            // In which case it'll be ignored
            setTimeout(() => { throw new Error(\"e\");r () }, 1)
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

// This passes standaloen but fails alongside others? Curious
test.serial.skip('process.exit', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'a',
      jobs: [
        {
          adaptor: 'helper@1.0.0',
          expression: `export default [exit()]`,
        },
      ],
    };

    engine.execute(plan).on(WORKFLOW_ERROR, (evt) => {
      t.is(evt.type, 'ExitError');
      t.is(evt.severity, 'kill');
      t.is(evt.message, 'Process exited with code: 42');
      done();
    });
  });
});
