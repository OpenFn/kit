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

type Mem = {
  job: number; // heapUsed in bytes
  system: number; // rss in bytes
};

// This helper will run a workflow and return
// memory usage per run
const run = async (t, workflow: ExecutionPlan) => {
  const useage: Record<string, Mem> = {};

  const notify = (evt: string, payload: NotifyJobCompletePayload) => {
    if (evt === NOTIFY_JOB_COMPLETE) {
      useage[payload.jobId] = payload.mem;
    }
  };

  const state = await callRuntime(
    workflow,
    {},
    {
      strict: false,
      callbacks: { notify },
    }
  );
  logUsage(t, useage.a);
  return { state, useage };
};

const logUsage = (t: any, mem: Mem, label = '') => {
  // What kind of rounding should I Do?
  // Rounding to an integer is best for humans but I think in these tests we lose a lot of fidelity
  // I mean you could lose nearly 500kb of accuracy, that's a lot!
  const job = (mem.job / 1024 / 1024).toFixed(2);
  const system = (mem.system / 1024 / 1024).toFixed(2);
  t.log(`${label} job: ${job}mb / system ${system}mb`);
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
};

test('emit memory usage to job-complete', async (t) => {
  const plan = {
    jobs: [
      {
        id: 'a',
        // This seems to use ~55mb of heap (job)
        expression: [(s) => s],
      },
    ],
  };

  const { useage } = await run(t, plan);
  t.true(!isNaN(useage.a.job));
  t.true(!isNaN(useage.a.system));
  t.true(useage.a.job < useage.a.system);
});

test('report memory usage for a job to state', async (t) => {
  const plan = {
    jobs: [
      {
        id: 'a',
        expression: [expressions.readMemory('a')],
      },
    ],
  };

  const { state } = await run(t, plan);
  logUsage(t, state.a, 'state: ');

  t.true(!isNaN(state.a.job));
  t.true(!isNaN(state.a.system));
  t.true(state.a.job < state.a.system);
});
