/**
 *  server needs to
 *
 * - create a runtime manager
 * - know how to speak to a lightning endpoint to  fetch workflows
 *    Is this just a string url?
 *
 */

import Koa from 'koa';
import createAPI from './api';
import startWorkLoop from './work-loop';
import convertAttempt from './util/convert-attempt';
import { Attempt } from './types';

const postResult = async (
  rtmId: string,
  lightningUrl: string,
  attemptId: string,
  state: any
) => {
  if (lightningUrl) {
    const result = await fetch(
      `${lightningUrl}/api/1/attempts/complete/${attemptId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          rtm_id: rtmId,
          state: state,
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
  }
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

function createServer(rtm: any, options: ServerOptions = {}) {
  const app = new Koa();

  const execute = (attempt: Attempt) => {
    const plan = convertAttempt(attempt);
    rtm.execute(plan);
  };

  const apiRouter = createAPI();
  app.use(apiRouter.routes());
  app.use(apiRouter.allowedMethods());

  app.listen(options.port || 1234);

  app.destroy = () => {
    // TODO close the work loop
  };

  if (options.lightning) {
    startWorkLoop(options.lightning, rtm.id, execute);
  }

  // TODO how about an 'all' so we can "route" events?
  rtm.on('workflow-complete', ({ id, state }) => {
    postResult(rtm.id, options.lightning!, id, state);
  });

  // TMP doing this for tests but maybe its better done externally
  app.on = (...args) => rtm.on(...args);
  app.once = (...args) => rtm.once(...args);

  // debug API to run a workflow
  // Used in unit tests
  // Only loads in dev mode?
  app.execute = execute;

  return app;
}

export default createServer;
