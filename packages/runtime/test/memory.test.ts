/**
 * IGNORED BY AVA
 * RUN WITH pnpm test:memory
 * */

import test from 'ava';

import {
  ExecutionPlan,
  NOTIFY_JOB_COMPLETE,
  NotifyJobCompletePayload,
} from '../src';
import callRuntime from '../src/runtime';

/**
 * This file contains various memory tests for runtime usage
 * The aim right now sis to understand how accurate process.memoryUsage()
 * reports are at the end of the job
 *
 * Something to bear in mind here is that all the tests run in the same process and share memory
 * I fully expect test 1 to have an impact on test 2
 * Part of the testing is to understand how much
 *
 * Also a consideration for the engine: after a job completes, I don't think we do any cleanup
 * of the SourceTextModule and context etc that we created for it.
 *
 * In the CLI this doesn't mattter because the process ends, and actually in the worker right now
 * We burn the thread so it still doesn't matter much/
 */

test.afterEach(() => {
  // Force gc to try and better isolate tests
  // THis may not work and maybe we need to use threads or something to ensure a pristine environment
  // Certainly runs seem to affect each other in the same process (no suprise there)
  // @ts-ignore
  global.gc();
});

type Mem = {
  job: number; // heapUsed in bytes
  system: number; // rss in bytes
};

// This helper will run a workflow and return
// memory usage per run
const run = async (t, workflow: ExecutionPlan) => {
  const mem: Record<string, Mem> = {};

  const notify = (evt: string, payload: NotifyJobCompletePayload) => {
    if (evt === NOTIFY_JOB_COMPLETE) {
      mem[payload.jobId] = payload.mem;
      logUsage(t, payload.mem, `job ${payload.jobId}`);
    }
  };

  const state = await callRuntime(
    workflow,
    {},
    {
      strict: false,
      callbacks: { notify },
      globals: {
        process: {
          memoryUsage: () => process.memoryUsage(),
        },
      },
    }
  );
  return { state, mem };
};

const logUsage = (t: any, mem: Mem, label = '') => {
  // What kind of rounding should I Do?
  // Rounding to an integer is best for humans but I think in these tests we lose a lot of fidelity
  // I mean you could lose nearly 500kb of accuracy, that's a lot!
  const job = (mem.job / 1024 / 1024).toFixed(2);
  const system = (mem.system / 1024 / 1024).toFixed(2);
  t.log(`${label}: ${job}mb / system ${system}mb`);
};

// const jobs = {
//   fn: () => 'export default [(s) => s]',

// };

const expressions = {
  readMemory: (jobName: string) => (s: any) => {
    // Hmm, the rounded human number actually looks quite different to theactual reported number
    const mem = process.memoryUsage();
    s[jobName] = { job: mem.heapUsed, system: mem.rss };
    return s;
  },
  createArray: (numberofElements: number) => (s: any) => {
    s.data = Array(numberofElements).fill('bowser');
    return s;
  },
};

// assert that b is within tolerance% of the value of a
const roughlyEqual = (a: number, b: number, tolerance: number) => {
  const diff = Math.abs(a - b);
  return diff <= a * tolerance;
};

test.serial('roughly equal', (t) => {
  t.true(roughlyEqual(10, 10, 0)); // exactly equal, no tolerance
  t.false(roughlyEqual(10, 11, 0)); // not equal, no tolerance
  t.false(roughlyEqual(10, 9, 0)); // not equal, no tolerance

  t.true(roughlyEqual(10, 11, 0.1)); // roughly equal with 10% tolerance
  t.true(roughlyEqual(10, 9, 0.1)); // roughly equal with 10% tolerance
  t.false(roughlyEqual(10, 12, 0.1)); // not equal with 10% tolerance
});

test.serial('emit memory usage to job-complete', async (t) => {
  const plan = {
    jobs: [
      {
        id: 'a',
        // This seems to use ~55mb of heap (job)
        expression: [(s) => s],
      },
    ],
  };

  const { mem } = await run(t, plan);
  t.true(!isNaN(mem.a.job));
  t.true(!isNaN(mem.a.system));
  t.true(mem.a.job < mem.a.system);
});

test.serial('report memory usage for a job to state', async (t) => {
  const plan = {
    jobs: [
      {
        id: 'a',
        expression: [expressions.readMemory('a')],
      },
    ],
  };

  const { state } = await run(t, plan);
  logUsage(t, state.a, 'state:');

  t.true(!isNaN(state.a.job));
  t.true(!isNaN(state.a.system));
  t.true(state.a.job < state.a.system);
});

test.serial('report memory usage multiple times', async (t) => {
  const plan = {
    jobs: [
      {
        id: 'a',
        expression: [
          expressions.readMemory('a'), // ~56mb
          expressions.readMemory('b'),
          expressions.readMemory('c'),
          expressions.readMemory('d'),
        ],
      },
    ],
  };

  const { state, mem } = await run(t, plan);
  logUsage(t, state.a, 'state a');
  logUsage(t, state.b, 'state b');
  logUsage(t, state.c, 'state c');
  logUsage(t, state.d, 'state d');

  // Each job should use basically the same memory interally (within 2%)
  t.true(roughlyEqual(state.a.job, state.d.job, 0.002));

  // The total memory should be about the last job's memory
  t.true(roughlyEqual(mem.a.job, state.d.job, 0.002));
});

// This test shows that creating a large array will increase the memory used by a job
test.serial('create a large array in a job', async (t) => {
  const plan = {
    jobs: [
      {
        id: 'a',
        expression: [
          expressions.readMemory('a1'), // ~56mb
          expressions.createArray(10e6), // 10 million ~76mb
          expressions.readMemory('a2'), // ~133mb
        ],
      },
    ],
  };

  const { state, mem } = await run(t, plan);
  logUsage(t, state.a1, 'state a1');
  logUsage(t, state.a2, 'state a2');

  // The second read should have more memory
  t.true(state.a2.job > state.a1.job);

  // The final job memory is a lot bigger because  AFTER the job we serialize state.data
  // Which of course has a huge array on it - so memory baloons¬
  t.true(mem.a.job > state.a1.job + state.a2.job);
});

// This test proves that running a job from a string or by passing in a function
// doesn't really affect memory usage
test.serial('create a large array in a job without closures', async (t) => {
  const f1 = `(s) => {
    const mem = process.memoryUsage();
    s.a = { job: mem.heapUsed, system: mem.rss };
    return s;
  }`;

  const f2 = `(s) => {
    s.data = Array(10e6).fill('bowser');
    return s;
  }`;

  const f3 = `(s) => {
    const mem = process.memoryUsage();
    s.b = { job: mem.heapUsed, system: mem.rss };
    return s;
  }`;

  const expression = `export default [${f1}, ${f2}, ${f3}]`;

  const plan = {
    jobs: [
      {
        id: 'a',
        expression,
      },
    ],
  };

  const { state, mem } = await run(t, plan);
  logUsage(t, state.a, 'state a');
  logUsage(t, state.b, 'state b');

  // The second read should have more memory
  t.true(state.b.job > state.a.job);

  // The final job memory is a lot bigger because  AFTER the job we serialize state.data
  // Which of course has a huge array on it - so memory baloons
  t.true(mem.a.job > state.a.job + state.b.job);
});

// This test proves that writing a lot of data to state dramatically increases final memory
// Note that we can surely optimise the serialisation step, but that's another story
test.serial(
  "create a large array in a job but don't write it to state",
  async (t) => {
    const plan = {
      jobs: [
        {
          id: 'a',
          expression: [
            expressions.readMemory('a1'), // ~56mb
            expressions.createArray(10e6), // 10 million ~76mb
            (s) => {
              delete s.data;
              return s;
            },
            expressions.readMemory('a2'), // ~133mb
          ],
        },
      ],
    };

    const { state, mem } = await run(t, plan);
    logUsage(t, state.a1, 'state a1');
    logUsage(t, state.a2, 'state a2');

    // The second read should have more memory
    t.true(state.a2.job > state.a1.job);

    // In this example, because we didn't return state,
    // the final memory is basically the same as the last operation
    t.true(roughlyEqual(mem.a.job, state.a2.job, 0.001));
  }
);

// This test basically comfirms that final memory is not peak memory
// because GC can dramatically change the reported memory usage (thank goodness!)
test.serial(
  'create a large array in a job, run gc, compare peak and  final memory',
  async (t) => {
    const plan = {
      jobs: [
        {
          id: 'a',
          expression: [
            (s) => {
              // clean up first
              global.gc();
              return s;
            },
            expressions.readMemory('a'),
            expressions.createArray(10e6), // 10 million ~76mb
            expressions.readMemory('b'),
            (s) => {
              delete s.data;
              global.gc();
              return s;
            },
            expressions.readMemory('c'),
          ],
        },
      ],
    };

    const { state, mem } = await run(t, plan);
    logUsage(t, state.b, 'peak');

    // The first job should use over 100mb
    t.true(state.b.job > 100 * 1024 * 1024);

    // the final state should be the intial state
    t.true(roughlyEqual(mem.a.job, state.a.job, 0.01));
  }
);

test.todo('will gc run if we leave a long timeout?');
