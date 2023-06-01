import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'node:events';
import workerpool from 'workerpool';
import { ExecutionPlan } from '@openfn/runtime';

// import * as e from './events';
// import createAutoinstall from './runners/autoinstall';
import createCompile from './runners/compile';
import createExecute from './runners/execute';
import createLogger, { Logger } from '@openfn/logger';

export type State = any; // TODO I want a nice state def with generics

// hmm, may need to support this for unit tests (which does kind of make sense)
type LiveJob = Array<(s: State) => State>;

type JobRegistry = Record<string, string | LiveJob>;

// Archive of every job we've run
// Fien to just keep in memory for now
type JobStats = {
  id: string;
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

type RTMOptions = {
  resolvers: LazyResolvers;
  logger: Logger;
  useMock: false;
  repoDir: string;
};

const createRTM = function (serverId?: string, options: RTMOptions = {}) {
  const { resolvers, useMock } = options;
  let { repoDir } = options;

  const id = serverId || crypto.randomUUID();
  const logger = options.logger || createLogger('RTM', { level: 'debug' });

  const jobsList: Map<string, JobStats> = new Map();
  const activeJobs: string[] = [];

  const registry: JobRegistry = {};

  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const p = path.resolve(dirname, useMock ? './mock-worker.js' : './worker.js');
  const workers = workerpool.pool(p);

  const events = new EventEmitter();

  if (!repoDir) {
    repoDir = '/tmp/openfn/repo';
    logger.info('Defaulting repoDir to ', repoDir);
  }

  const acceptJob = (jobId: string, name: string, threadId: number) => {
    logger.info('accept job ', jobId);
    if (jobsList.has(jobId)) {
      throw new Error(`Job with id ${jobId} is already in progress`);
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

  const completeJob = (jobId: string, state: any) => {
    logger.success('complete job ', jobId);
    logger.info(state);
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

  // Create "runner" functions for execute and compile
  const execute = createExecute(workers, repoDir, logger, {
    accept: acceptJob,
  });
  const compile = createCompile(logger, repoDir);

  // How much of this happens inside the worker?
  // Shoud the main thread handle compilation? Has to if we want to cache
  // Unless we create a dedicated compiler worker
  // TODO error handling, timeout
  const handleExecute = async (plan: ExecutionPlan) => {
    logger.debug('Executing plan ', plan.id);

    // TODO autoinstall

    const compiledPlan = await compile(plan);
    logger.debug('plan compiled ', plan.id);
    const result = await execute(compiledPlan);
    completeJob(plan.id!, result);

    logger.debug('finished executing plan ', plan.id);
    // Return the result
    // Note that the mock doesn't behave like ths
    // And tbf I don't think we should keep the promise open - there's no point?
    return result;
  };
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

    _registry: registry,
  };
};

export default createRTM;
