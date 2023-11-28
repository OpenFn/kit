import test from 'ava';
import createEngine, { EngineOptions } from '../src/engine';
import { createMockLogger } from '@openfn/logger';
import { WORKFLOW_ERROR } from '../src/events';

let engine;

test.before(async () => {
  const logger = createMockLogger('', { level: 'debug' });

  const options: EngineOptions = {
    logger,
    repoDir: '.',
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
test('syntax error: missing bracket', (t) => {
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

test('syntax error: illegal throw', (t) => {
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

test('syntax error: oom error', (t) => {
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
