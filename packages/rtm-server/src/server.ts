/**
 *  server needs to
 *
 * - create a runtime maager
 * - know how to speak to a lightning endpoint to  fetch workflows
 *    Is this just a string url?
 *
 */

import Koa from 'koa';
import axios from 'axios';
import createAPI from './api';

import createMockRTM from './mock/runtime-manager';

// This loop will  call out to ask for work, with a backoff
const workBackoffLoop = async (lightningUrl: string, rtm: any) => {
  let timeout = 100; // TODO strange stuff happens if this has a low value

  const result = await axios.post(`${lightningUrl}/api/1/attempts/next`, {
    id: rtm.id,
  });

  if (result.data) {
    // TODO handle multiple attempts
    const [attempt] = result.data;
    rtm.execute(attempt);
  } else {
    timeout = timeout * 2;
  }
  setTimeout(() => {
    workBackoffLoop(lightningUrl, rtm);
  }, timeout);
};

const postResult = async (
  lightningUrl: string,
  attemptId: string,
  state: any
) => {
  const result = await axios.post(
    `${lightningUrl}/api/1/attempts/complete/${attemptId}`,
    state || {}
  );
  // TODO what if result is not 200?
  // Backoff and try again?
};

type ServerOptions = {
  backoff?: number;
  maxWorkflows?: number;
  port?: number;
  lightning?: string; // url to lightning instance
  rtm?: any;
};

function createServer(options: ServerOptions = {}) {
  const app = new Koa();

  const rtm = options.rtm || new createMockRTM();

  const apiRouter = createAPI();
  app.use(apiRouter.routes());
  app.use(apiRouter.allowedMethods());

  app.listen(options.port || 1234);

  if (options.lightning) {
    workBackoffLoop(options.lightning, rtm);

    rtm.on('workflow-complete', ({ id, state }) => {
      postResult(options.lightning!, id, state);
    });
  }

  // TMP doing this for tests but maybe its better done externally
  app.on = (...args) => rtm.on(...args);
  app.once = (...args) => rtm.once(...args);

  return app;

  // if not rtm create a mock
  // setup routes
  // start listening on options.port
  // return the server
}

export default createServer;
