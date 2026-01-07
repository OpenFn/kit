import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';

import createEngine, { EngineOptions } from '../src/engine';
import { WORKFLOW_ERROR, WORKFLOW_COMPLETE } from '../src/events';
import type { RuntimeEngine } from '../src/types';

let engine: RuntimeEngine;

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
    // proxyStdout: true,
  };

  // This uses the real runtime and real worker
  engine = await createEngine(options);
});

// This should exit gracefully with a compile error
test.serial('syntax error: missing bracket', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'a',
      workflow: {
        steps: [
          {
            id: 'x',
            // This is subtle syntax error
            expression: 'fn((s) => { return s )',
          },
        ],
      },
      options: {},
    };

    engine.execute(plan, {}).on(WORKFLOW_ERROR, (evt) => {
      t.is(evt.type, 'CompileError');

      // t.is(evt.name, 'SyntaxError'); // TODO fix in #1004
      t.true(typeof evt.threadId === 'number');
      t.is(evt.message, 'x: Unexpected token (1:21)');
      done();
    });
  });
});

test.serial('reference error: var not defined', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'a',
      workflow: {
        steps: [
          {
            id: 'x',
            expression: 'export default [() => s]',
          },
        ],
      },
      options: {},
    };

    engine.execute(plan, {}).on(WORKFLOW_ERROR, (evt) => {
      t.is(evt.message, 'ReferenceError: s is not defined');
      // TODO this is the standard we want in https://github.com/OpenFn/kit/issues/1004
      t.is(evt.type, 'RuntimeCrash');
      // t.is(evt.name, 'ReferenceError'); // TODO fix in #1004
      t.true(typeof evt.threadId === 'number');
      done();
    });
  });
});

test.serial('syntax error: illegal throw', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'b',
      workflow: {
        steps: [
          {
            id: 'z',
            // This is also subtle syntax error
            expression: 'fn(() => throw "e")',
          },
        ],
      },
      options: {},
    };

    engine.execute(plan, {}).on(WORKFLOW_ERROR, (evt) => {
      t.is(evt.type, 'CompileError');
      t.true(typeof evt.threadId === 'number');
      t.is(evt.message, 'z: Unexpected token (1:9)');
      done();
    });
  });
});

test.serial('thread oom error', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'c',
      workflow: {
        steps: [
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
      },
      options: {},
    };

    engine.execute(plan, {}).on(WORKFLOW_ERROR, (evt) => {
      t.is(evt.type, 'OOMError');
      t.is(evt.severity, 'kill');
      t.is(evt.message, 'Run exceeded maximum memory usage');
      done();
    });
  });
});

// prone to failing in CI
test.serial.skip('vm oom error', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'd',
      workflow: {
        steps: [
          {
            expression: `export default [(s) => {
              s.a = [];
              while(true) {
                s.a.push(new Array(1e8).fill("oom"));
              }
              return s;
            }]`,
          },
        ],
      },
      options: {},
    };

    engine.execute(plan, {}).on(WORKFLOW_ERROR, (evt) => {
      t.is(evt.type, 'OOMError');
      t.is(evt.severity, 'kill');
      t.is(evt.message, 'Run exceeded maximum memory usage');
      done();
    });
  });
});

test.serial('state object too big', async (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'x',
      workflow: {
        steps: [
          {
            expression: `export default [(s) => {
              s.data = new Array(1024 * 1024).fill("x").join("");
              return s;
            }]`,
          },
        ],
      },
    };

    const options = {
      stateLimitMb: 0.1,
    };

    engine.execute(plan, {}, options).on(WORKFLOW_ERROR, (evt) => {
      console.log(evt);
      t.is(evt.type, 'StateTooLargeError');
      t.is(evt.severity, 'kill');
      t.is(evt.message, 'State exceeds the limit of 0.1mb');
      done();
    });
  });
});

test.serial('execution error from async code', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'e',
      workflow: {
        steps: [
          {
            // this error will throw within the promise, and so before the job completes
            // But REALLY naughty code could throw after the job has finished
            // In which case it'll be ignored
            // Also note that the wrapping promise will never resolve
            expression: `export default [(s) => new Promise((r) => {
              setTimeout(() => { throw new Error(\"err\"); r() }, 10)
            })]`,
          },
        ],
      },
      options: {},
    };

    engine.execute(plan, {}).on(WORKFLOW_ERROR, (evt) => {
      t.is(evt.type, 'ExecutionError');
      t.is(evt.severity, 'crash');

      done();
    });
  });
});

test.serial('after uncaught exception, free up the pool', (t) => {
  const plan1 = {
    id: 'e',
    workflow: {
      steps: [
        {
          expression: `export default [(s) => new Promise((r) => {
            setTimeout(() => { throw new Error(\"err\"); r() }, 10)
          })]`,
        },
      ],
    },
    options: {},
  };
  const plan2 = {
    id: 'a',
    workflow: {
      steps: [
        {
          expression: `export default [(s) => s]`,
        },
      ],
    },
    options: {},
  };

  return new Promise((done) => {
    engine.execute(plan1, {}).on(WORKFLOW_ERROR, (evt) => {
      t.log('First workflow failed');
      t.is(evt.type, 'ExecutionError');
      t.is(evt.severity, 'crash');

      engine.execute(plan2, {}).on(WORKFLOW_COMPLETE, () => {
        t.log('Second workflow completed');
        done();
      });
    });
  });
});

test.serial('emit a crash error on process.exit()', (t) => {
  return new Promise((done) => {
    const plan = {
      id: 'z',
      workflow: {
        steps: [
          {
            adaptors: ['@openfn/helper@1.0.0'],
            expression: 'export default [exit()]',
          },
        ],
      },
      options: {},
    };

    engine.execute(plan, {}).on(WORKFLOW_ERROR, (evt) => {
      t.is(evt.type, 'ExitError');
      t.is(evt.severity, 'crash');
      t.is(evt.message, 'Worker thread exited with code: 42');
      done();
    });
  });
});
