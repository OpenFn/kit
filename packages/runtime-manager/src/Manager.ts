import { EventEmitter } from 'node:events';
import workerpool from 'workerpool';

// Manages a pool of workers

class Bus extends EventEmitter {}

type JobRegistry = Record<string, string>

const Manager = function() {
  console.log('creating new manager')
  const registry: JobRegistry = {};
  const workers = workerpool.pool(__filename + './worker.js');
  
  // Run a job in a worker
  // Accepts the name of a registered job
  const run = async (name: string) => {
    const src =  registry[name];
    if (src) {
      workers.exec()
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

  // const getActiveJobs = () => {

  // }

  const bus = new Bus();
  

  return {
    run,
    registerJob,
    getRegisteredJobs,
    on: (evt: string, fn: () => void) => bus.on(evt, fn),
    // I don't think we actually want a publish event?
  }
};

export default Manager;