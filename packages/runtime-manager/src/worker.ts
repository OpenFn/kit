// Dedicated worker for running jobs
// Security thoughts: the process inherits the node command arguments
// (it has to for experimental modules to work)
// Is this a concern? If secrets are passed in they could be visible
// The sandbox should hep
import run from '@openfn/runtime';
import { parentPort, threadId } from 'worker_threads';

type Handshake = {
  type: 'handshake',
  jobId: number,
  threadId: number
}

function postMessage(obj: Handshake) {
  parentPort?.postMessage({
    ready: true, // magic flag we apparently need to send a message?!
    ...obj,
  });
}

// When the worker starts, it should report back its id
// We need the runaround here because our worker pool obfuscates it
function init(jobId: number) {
  postMessage({ type: 'handshake', jobId, threadId });
}

export default async (args: [number, string, any]) => {
  const [jobId, src, state] = args;
  const p = run(src, state);
  init(jobId)
  return await p;
};

// export default (args: [number, string, any]) => {
//   init(args[0])
// }