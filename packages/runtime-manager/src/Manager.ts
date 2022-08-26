import path from 'node:path';
import workerpool from 'workerpool';
import * as e from './events';

export type State = any; // TODO I want a nice state def with generics

type JobRegistry = Record<string, string>;

let jobid = 1000;

// Archive of every job we've run
// Fien to just keep in memory for now
type JobStats = {
  id: number,
  name: string,
  status: 'pending' | 'done' | 'err',
  startTime: number,
  threadId: number,
  duration?: number,
  error?: string
  result?: any // State
}

// Manages a pool of workers
const Manager = function() {
  const jobsList: Map<number, JobStats> = new Map();
  const activeJobs: number[] = [];
  
  const registry: JobRegistry = {};
  const workers = workerpool.pool(path.resolve('./dist/worker.js'));

  const acceptJob = (jobId: number, name: string, threadId: number) => {
    if (jobsList.has(jobId)) {
      throw new Error(`Job with id ${jobId} is already defined`);
    }
    jobsList.set(jobId, {
      id: jobId,
      name,
      status: 'pending',
      threadId,
      startTime: new Date().getTime()
    });
    activeJobs.push(jobId);
  };

  const completeJob = (jobId: number, state: any) => {
    if (!jobsList.has(jobId)) {
      throw new Error(`Job with id ${jobId} is not defined`);
    }
    const job = jobsList.get(jobId)!;
    job.status ='done';
    job.result = state;
    job.duration = new Date().getTime() - job.startTime;
    const idx = activeJobs.findIndex((id) => id === jobId);
    activeJobs.splice(idx, 1);
  }

  // Run a job in a worker
  // Accepts the name of a registered job
  const run = async (name: string, state?: any) => {
    const src =  registry[name];
    if (src) {
      jobid++
      // TODO is there any benefit in using an arraybuffer to pass data directly?
      const result = await workers.exec('run', [jobid, src, state], {
        on: ({ type, ...args }: e.JobEvent) => {
          if (type === e.ACCEPT_JOB) {
            const { jobId, threadId } = args as e.AcceptJobEvent
            acceptJob(jobId, name, threadId);
          }
          else if (type === e.COMPLETE_JOB) {
            const { jobId, state } = args as e.CompleteJobEvent
            completeJob(jobId, state);
          }
        }
      });
      return result;
    }
    throw new Error("Job not found: " + name);
  };

  // register a job to enable it to be run
  // should we validate before registering?
  // should we track versions? This isn't a content manager though... idk
  const registerJob = (name: string, source: string) => {
    if (registry[name]) {
      throw new Error("Job already registered: " + name);
    }
    registry[name] = source;
  };

  const getRegisteredJobs = () => Object.keys(registry);

  const getActiveJobs = (): JobStats[] => {
    const jobs = activeJobs.map(id => jobsList.get(id))
    return jobs.filter(j => j) as JobStats[] // no-op for typings
  }

  const getCompletedJobs = (): JobStats[] => {
    return Array.from(jobsList.values()).filter(job => job.status === 'done')
  }

  const getErroredJobs = (): JobStats[] => {
    return Array.from(jobsList.values()).filter(job => job.status === 'err')
  }

  return {
    run,
    registerJob,
    getRegisteredJobs,
    getActiveJobs,
    getCompletedJobs,
    getErroredJobs,
  }
};

export default Manager;