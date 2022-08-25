import path from 'node:path';
import Piscina from 'piscina';

type JobRegistry = Record<string, string>;

// Manages a pool of workers
const Manager = function() {
  const registry: JobRegistry = {};
  //const workers = workerpool.pool(path.resolve('./dist/worker.js'), { workerType: 'process' });
  const workers = new Piscina({
    filename: path.resolve('./dist/worker.js')
  });

  workers.on('message', console.log)

  // Maintain state of each job
  // I really really want some details about the thread its running in...
  // this is useless tbh!
  const threadState: Record<string, any> = {};

  // Run a job in a worker
  // Accepts the name of a registered job
  const run = async (name: string, state?: any) => {
    const src =  registry[name];
    if (src) {
      // need a unique job + process id to go here
      threadState[name] = true
      const result = await workers.run([src, state])
      delete threadState[name];
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

  const getActiveJobs = () => {
    return workers.threads;
  }

  return {
    run,
    registerJob,
    getRegisteredJobs,
    getActiveJobs,
    // subscribe directly to worker events
    on: (evt: string, fn: () => void) => workers.on(evt, fn),
    // I don't think we actually want a publish event?
  }
};

export default Manager;