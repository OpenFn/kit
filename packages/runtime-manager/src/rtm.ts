import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import workerpool from 'workerpool';
import { ExecutionPlan } from '@openfn/runtime';

import * as e from './events';
import createAutoinstall from './runners/autoinstall';
import createCompile from './runners/compile';
import createExecute from './runners/execute';

export type State = any; // TODO I want a nice state def with generics

// hmm, may need to support this for unit tests (which does kind of make sense)
type LiveJob = Array<(s: State) => State>;

type JobRegistry = Record<string, string | LiveJob>;

let jobid = 1000;

// Archive of every job we've run
// Fien to just keep in memory for now
type JobStats = {
  id: number;
  name: string;
  status: 'pending' | 'done' | 'err';
  startTime: number;
  threadId: number;
  duration: number;
  error?: string;
  result?: any; // State
};

type Resolver<T> = (id: string) => Promise<T>;

// A list of helper functions which basically resolve ids into JSON
// to lazy load assets
export type LazyResolvers = {
  credentials?: Resolver<Credential>;
  state?: Resolver<State>;
  expressions?: Resolver<string>;
};

const createRTM = function (
  serverId?: string,
  resolvers?: LazyResolvers,
  useMock = false
) {
  const id = serverId || crypto.randomUUID();

  const jobsList: Map<number, JobStats> = new Map();
  const activeJobs: number[] = [];

  const registry: JobRegistry = {};
  const workers = workerpool.pool(
    path.resolve(useMock ? './dist/mock-worker.js' : './dist/worker.js')
  );

  const events = new EventEmitter();

  const acceptJob = (jobId: number, name: string, threadId: number) => {
    console.log('>> Accept job');
    if (jobsList.has(jobId)) {
      throw new Error(`Job with id ${jobId} is already defined`);
    }
    jobsList.set(jobId, {
      id: jobId,
      name,
      status: 'pending',
      threadId,
      startTime: new Date().getTime(),
      duration: -1,
    });
    activeJobs.push(jobId);
  };

  const completeJob = (jobId: number, state: any) => {
    console.log('>> complete job');
    if (!jobsList.has(jobId)) {
      throw new Error(`Job with id ${jobId} is not defined`);
    }
    const job = jobsList.get(jobId)!;
    job.status = 'done';
    job.result = state;
    job.duration = new Date().getTime() - job.startTime;
    const idx = activeJobs.findIndex((id) => id === jobId);
    activeJobs.splice(idx, 1);
  };

  const execute = createExecute(workers, acceptJob);
  const compile = createCompile(console as any, '/tmp/openfn/repo');

  // How much of this happens inside the worker?
  // Shoud the main thread handle compilation? Has to if we want to cache
  // Unless we create a dedicated compiler worker
  // TODO error handling, timeout
  const handleExecute = async (plan: ExecutionPlan) => {
    // autoinstall
    // compile it
    const compiledPlan = await compile(plan);
    console.log(JSON.stringify(compiledPlan, null, 2));

    const result = await execute(compiledPlan);
    console.log('RESULT', result);
    completeJob(plan.id!, result);

    // Return the result
    // Note that the mock doesn't behave like ths
    // And tbf I don't think we should keep the promise open - there's no point?
    return result;
  };

  // // Run a job in a worker
  // // Accepts the name of a registered job
  // const run = async (name: string, state?: any): Promise<JobStats> => {
  //   const src = registry[name];
  //   if (src) {
  //     const thisJobId = ++jobid;

  //     await workers.exec('run', [jobid, src, state], {
  //       on: ({ type, ...args }: e.JobEvent) => {
  //         if (type === e.ACCEPT_JOB) {
  //           const { jobId, threadId } = args as e.AcceptJobEvent;
  //           acceptJob(jobId, name, threadId);
  //         } else if (type === e.COMPLETE_JOB) {
  //           const { jobId, state } = args as e.CompleteJobEvent;
  //           completeJob(jobId, state);
  //         }
  //       },
  //     });
  //     return jobsList.get(thisJobId) as JobStats;
  //   }
  //   throw new Error('Job not found: ' + name);
  // };

  // register a job to enable it to be run
  // The job will be compiled
  // const registerJob = (name: string, source: string) => {
  //   if (registry[name]) {
  //     throw new Error('Job already registered: ' + name);
  //   }
  //   registry[name] = compile(source);
  // };

  // const getRegisteredJobs = () => Object.keys(registry);

  const getActiveJobs = (): JobStats[] => {
    const jobs = activeJobs.map((id) => jobsList.get(id));
    return jobs.filter((j) => j) as JobStats[]; // no-op for typings
  };

  const getCompletedJobs = (): JobStats[] => {
    return Array.from(jobsList.values()).filter((job) => job.status === 'done');
  };

  const getErroredJobs = (): JobStats[] => {
    return Array.from(jobsList.values()).filter((job) => job.status === 'err');
  };

  return {
    id,
    on: events.on,
    once: events.once,
    execute: handleExecute,
    // getStatus, // no tests on this yet, not sure if I want to commit to it

    getActiveJobs,
    getCompletedJobs,
    getErroredJobs,

    // TO REMOVE
    // run,
    // registerJob,
    // getRegisteredJobs,

    // For testing
    _registry: registry,
  };
};

export default createRTM;
