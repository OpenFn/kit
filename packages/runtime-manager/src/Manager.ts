import { EventEmitter } from 'node:events';
import path from 'node:path';
//import workerpool from 'workerpool';
import Piscina from 'piscina';

class Bus extends EventEmitter {};

type JobRegistry = Record<string, string>;

// Manages a pool of workers
const Manager = function() {
  const registry: JobRegistry = {};
  //const workers = workerpool.pool(path.resolve('./dist/worker.js'), { workerType: 'process' });
  const workers = new Piscina({
    filename: path.resolve('./dist/worker.js')
  });
  workers.on('ready', console.log)
  // Run a job in a worker
  // Accepts the name of a registered job
  const run = async (name: string) => {
    const src =  registry[name];
    if (src) {
      //return await workers.exec('runJob', [src])
      return await workers.run(src)
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