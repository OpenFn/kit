import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import {
  NOTIFY_JOB_COMPLETE,
  NOTIFY_JOB_ERROR,
  NOTIFY_JOB_START,
} from '../../src';
import execute from '../../src/execute/step';

import type { ExecutionContext } from '../../src/types';
import { State } from '@openfn/lexicon';

const createState = (data = {}) => ({
  data: data,
  configuration: {},
});

const logger = createMockLogger(undefined, { level: 'debug' });

const createContext = (args = {}) =>
  ({
    logger,
    plan: {
      options: {},
    },
    opts: {},
    notify: () => {},
    report: () => {},
    ...args,
  } as unknown as ExecutionContext);

test.afterEach(() => {
  logger._reset();
});

test.serial('resolve and return next for a simple step', async (t) => {
  const step = {
    id: 'j',
    expression: [(s: State) => s],
    next: { k: true, a: false },
  };
  const initialState = createState();
  const context = createContext();
  const { next, state } = await execute(context, step, initialState);

  t.deepEqual(state, { data: {} });
  t.deepEqual(next, ['k']);
});

test.serial('resolve and return next for a trigger-style step', async (t) => {
  const step = {
    id: 'j',
    next: { k: true, a: false },
  };
  const initialState = createState();
  const context = createContext();
  const { next, state } = await execute(context, step, initialState);

  t.deepEqual(state, initialState);
  t.deepEqual(next, ['k']);
});

test.serial('resolve and return next for a failed step', async (t) => {
  const step = {
    id: 'j',
    expression: [
      () => {
        throw 'e';
      },
    ],
    next: { k: true, a: false },
  };
  const initialState = createState();
  const context = createContext();
  const { next, state } = await execute(context, step, initialState);

  // Config should still be scrubbed from data
  t.deepEqual(state, { data: {} });
  t.deepEqual(next, ['k']);
});

test.serial(`notify ${NOTIFY_JOB_START}`, async (t) => {
  const step = {
    id: 'j',
    expression: [(s: State) => s],
  };
  const state = createState();

  const notify = (event: string, payload?: any) => {
    if (event === NOTIFY_JOB_START) {
      t.is(payload.jobId, 'j');
    }
  };

  const context = createContext({ notify });

  await execute(context, step, state);
});

test.serial(
  `don't notify ${NOTIFY_JOB_START} for trigger-style steps`,
  async (t) => {
    const step = {
      id: 'j',
    };
    const state = createState();

    const notify = (event: string, payload?: any) => {
      if (event === NOTIFY_JOB_START) {
        t.fail('should not notify step-start for trigger nodes');
      }
    };

    const context = createContext({ notify });

    await execute(context, step, state);
    t.pass('all ok');
  }
);

test.serial(`notify ${NOTIFY_JOB_COMPLETE} with no next`, async (t) => {
  const step = {
    id: 'j',
    expression: [(s: State) => s],
  };

  const state = createState();

  const notify = (event: string, payload: any) => {
    if (event === NOTIFY_JOB_COMPLETE) {
      const { state, duration, jobId, next, mem } = payload;
      t.truthy(state);
      t.deepEqual(state, state);
      t.deepEqual(next, []);
      t.assert(!isNaN(duration));
      t.true(duration < 100);
      t.truthy(mem);
      t.is(jobId, 'j');
    }
  };

  const context = createContext({ notify });

  await execute(context, step, state);
});

test.serial(`notify ${NOTIFY_JOB_COMPLETE} with two nexts`, async (t) => {
  const step = {
    id: 'j',
    expression: [(s: State) => s],
    next: { b: true, c: true },
  };

  const state = createState();

  const notify = (event: string, payload: any) => {
    if (event === NOTIFY_JOB_COMPLETE) {
      const { state, duration, jobId, next } = payload;
      t.truthy(state);
      t.deepEqual(state, state);
      t.deepEqual(next, ['b', 'c']);
      t.assert(!isNaN(duration));
      t.true(duration < 100);
      t.is(jobId, 'j');
    }
  };

  const context = createContext({ notify });

  await execute(context, step, state);
});

test.serial(
  `don't notify ${NOTIFY_JOB_COMPLETE} for trigger-style steps`,
  async (t) => {
    const step = {
      id: 'j',
    };
    const state = createState();

    const notify = (event: string) => {
      if (event === NOTIFY_JOB_COMPLETE) {
        t.fail('should not notify step-start for trigger nodes');
      }
    };

    const context = createContext({ notify });

    await execute(context, step, state);
    t.pass('all ok');
  }
);

test.serial(
  `notify ${NOTIFY_JOB_COMPLETE} should publish serializable state`,
  async (t) => {
    // Promises will trigger an exception if you try to serialize them
    // If we don't return finalState in  execute/expression, this test will fail
    const resultState = { x: new Promise((r) => r), y: 22 };
    const step = {
      id: 'j',
      expression: [() => resultState],
    };
    const state = createState();

    const notify = (event: string, payload: any) => {
      if (event === NOTIFY_JOB_COMPLETE) {
        const { state, duration, jobId } = payload;
        t.truthy(state);
        t.assert(!isNaN(duration));
        t.is(jobId, 'j');
      }
    };

    const context = createContext({ notify });

    await execute(context, step, state);
  }
);

test.serial(`notify ${NOTIFY_JOB_ERROR} for a fail`, async (t) => {
  const step = {
    id: 'j',
    expression: [
      () => {
        throw 'e';
      },
    ],
    next: { b: true },
  };

  const state = createState();

  const notify = (event: string, payload: any) => {
    if (event === NOTIFY_JOB_ERROR) {
      const { state, duration, jobId, next, error } = payload;
      t.truthy(state);
      t.is(error.message, 'e');
      t.is(error.name, 'JobError');
      t.is(error.severity, 'fail');

      t.deepEqual(state, state);
      t.deepEqual(next, ['b']);
      t.assert(!isNaN(duration));
      t.true(duration < 100);
      t.is(jobId, 'j');
    }
  };

  const context = createContext({ notify });

  await execute(context, step, state);
});

test.serial('log duration of execution', async (t) => {
  const step = {
    id: 'y',
    expression: [(s: State) => s],
  };
  const initialState = createState();
  const context = createContext();

  await execute(context, step, initialState);

  const duration = logger._find('success', /completed in/i);

  t.regex(duration?.message, /y completed in \d\d?ms/i);
});

test.serial('log memory usage', async (t) => {
  const step = {
    id: 'z',
    expression: [(s: State) => s],
  };
  const initialState = createState();
  const context = createContext();

  await execute(context, step, initialState);

  const memory = logger._find('debug', /step memory usage/i);

  // All we're looking for here is two strings of numbers in mb
  t.regex(memory?.message, /\d+mb(.+)\d+mb/i);
});

test.serial('log memory usage with profiler and peak', async (t) => {
  const step = {
    id: 'z',
    expression: [
      (s: State) => {
        return new Promise<any>((resolve) => setTimeout(() => resolve(s), 10));
      },
    ],
  };
  const initialState = createState();
  const context = createContext({
    opts: {
      profile: true,
    },
  });

  await execute(context, step, initialState);

  const memory = logger._find('debug', /step memory usage/i);
  // All we're looking for here is two strings of numbers in mb
  t.regex(memory?.message, /peak (\d)+(.+)\d(\d?)mb/i);
});

test.serial('warn if a non-leaf step does not return state', async (t) => {
  const step = {
    id: 'k',
    expression: [(s: State) => {}],
    next: { l: true },
  };

  const context = createContext();
  const state = createState();

  // @ts-ignore ts complains that the step does not return state
  const result = await execute(context, step, state);
  const warn = logger._find('warn', /did not return a state object/);
  t.truthy(warn);
});

test.serial('do not warn if a leaf step does not return state', async (t) => {
  const step = {
    id: 'k',
    expression: [(s: State) => {}],
  };

  const context = createContext();
  const state = createState();

  // @ts-ignore ts complains that the step does not return state
  const result = await execute(context, step, state);

  const warn = logger._find('warn', /did not return a state object/);
  t.falsy(warn);
});

test.serial(
  'do not warn a non-leaf step does not return state and there was an error',
  async (t) => {
    const step = {
      id: 'k',
      expression: [
        (s: State) => {
          throw 'e';
        },
      ],
      next: { l: true },
    };

    const context = createContext();
    const state = createState();

    // @ts-ignore ts complains that the step does not return state
    const result = await execute(context, step, state);

    const warn = logger._find('warn', /did not return a state object/);
    t.falsy(warn);
  }
);

test.serial('output state should be serializable', async (t) => {
  const job = [async (s: State) => s];

  const step = {
    id: 'k',
    expression: job,
  };

  const circular = {};
  circular.self = circular;

  const state = createState({
    circular,
    fn: () => {},
  });

  const context = createContext();

  const result = await execute(context, step, state);

  t.notThrows(() => JSON.stringify(result));

  t.is(result.state.data.circular.self, '[Circular]');
  t.falsy(result.state.data.fn);
});

test.serial(
  'configuration is removed from the result by default',
  async (t) => {
    const job = [async (s: State) => s];
    const step = {
      id: 'k',
      expression: job,
    };
    const context = createContext();

    const result = await execute(context, step, { configuration: {} });
    t.deepEqual(result.state, { data: {} });
  }
);

test.serial(
  'statePropsToRemove removes multiple props from state',
  async (t) => {
    const job = [async (s: State) => s];
    const step = {
      id: 'k',
      expression: job,
    };
    const statePropsToRemove = ['x', 'y'];
    const context = createContext({ opts: { statePropsToRemove } });

    const result = await execute(context, step, { x: 1, y: 1, z: 1 });
    t.deepEqual(result.state, { data: {}, z: 1, configuration: {} });
  }
);

test.serial(
  'statePropsToRemove logs to debug when a prop is removed',
  async (t) => {
    const job = [async (s: State) => s];
    const step = {
      id: 'k',
      expression: job,
    };
    const statePropsToRemove = ['x'];

    const context = createContext({ opts: { statePropsToRemove } });

    const result = await execute(context, step, { x: 1, y: 1, z: 1 });
    t.deepEqual(result.state, { data: {}, y: 1, z: 1, configuration: {} });

    const log = logger._find('debug', /Cleaning up state. Removing keys: x/i);
    t.truthy(log);
  }
);

test.serial(
  'no props are removed from state if an empty array is passed to statePropsToRemove',
  async (t) => {
    const job = [async (s: State) => s];
    const step = {
      id: 'k',
      expression: job,
    };
    const statePropsToRemove: string[] = [];
    const context = createContext({ opts: { statePropsToRemove } });

    const state = { x: 1, configuration: 1 };
    const result = await execute(context, step, state as any);
    t.deepEqual(result.state, { x: 1, configuration: {}, data: {} });
  }
);

test.serial(
  'no props are removed from state if a falsy value is passed to statePropsToRemove',
  async (t) => {
    const job = [async (s: State) => s];
    const step = {
      id: 'k',
      expression: job,
    };
    const statePropsToRemove = undefined;
    const context = createContext({ opts: { statePropsToRemove } });

    const state = { x: 1, configuration: 1 };
    const result = await execute(context, step, state as any);
    t.deepEqual(result.state, { x: 1, data: {} });
  }
);

test.serial('config is removed from the result', async (t) => {
  const job = [async (s: State) => s];
  const step = {
    id: 'k',
    expression: job,
  };
  const context = createContext({ opts: {} });

  const result = await execute(context, step, { configuration: {} });
  t.deepEqual(result.state, { data: {} });
});

test.serial(
  'output state is returned verbatim, apart from config',
  async (t) => {
    const state = {
      data: {},
      references: [],
      configuration: {},
      x: true,
    };
    const job = [async () => ({ ...state })];
    const step = {
      id: 'k',
      expression: job,
    };

    const context = createContext();

    const result = await execute(context, step, {});
    t.deepEqual(result.state, {
      data: {},
      references: [],
      x: true,
    });
  }
);
