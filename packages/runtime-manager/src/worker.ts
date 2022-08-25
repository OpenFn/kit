// Dedicated worker for running jobs
// Security thoughts: the process inherits the node command arguments
// (it has to for experimental modules to work)
// Is this a concern? If secrets are passed in they could be visible
// The sandbox should hep
import run from '@openfn/runtime';

export default async (args: [string, any]) => {
  const [src, state] = args;
  return await run(src, state);
};
