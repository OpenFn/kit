// // Dedicated worker for running jobs
// // Interesting plot twist: how do we enable vm modules in the thread?
// import workerpool from 'workerpool';
// import run from '@openfn/runtime';

// const runJob = async (src: string) => {
//   return await run(src);
// };

// workerpool.worker({
//   runJob
// })

// Dedicated worker for running jobs
// Security thoughts: the process inherits the node command arguments
// (it has to for experimental modules to work)
// Is this a concern? If secrets are passed in they could be visible
// The sandbox should hep
import run from '@openfn/runtime';

export default async (src: string) => {
  return await run(src);
};
