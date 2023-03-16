/**
 *  server needs to
 *
 * - create a runtime maager
 * - know how to speak to a lightning endpoint to  fetch workflows
 *    Is this just a string url?
 *
 */

// This loop will  call out to ask for work, with a backof
const workerLoop = () => {};

type ServerOptions = {
  backoff: number;
  maxWorkflows: number;
  port: number;
};

function createServer(options, rtm) {
  // if not rtm create a mock
  // setup routes
  // start listening on options.port
  // return the server
}
