/**
 *  server needs to
 *
 * - create a runtime manager
 * - know how to speak to a lightning endpoint to  fetch workflows
 *    Is this just a string url?
 *
 */

import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';

import createAPI from './api';
import startWorkLoop from './work-loop';
import convertAttempt from './util/convert-attempt';
import { Attempt } from './types';
import { createMockLogger, Logger } from '@openfn/logger';

const postResult = async (
  rtmId: string,
  lightningUrl: string,
  attemptId: string,
  state: any
) => {
  if (lightningUrl) {
    await fetch(`${lightningUrl}/api/1/attempts/complete/${attemptId}`, {
      method: 'POST',
      body: JSON.stringify({
        rtm_id: rtmId,
        state: state,
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }
  // TODO what if result is not 200?
  // Backoff and try again?
};

// Send a batch of logs
const postLog = async (
  rtmId: string,
  lightningUrl: string,
  attemptId: string,
  messages: any[]
) => {
  await fetch(`${lightningUrl}/api/1/attempts/log/${attemptId}`, {
    method: 'POST',
    body: JSON.stringify({
      rtm_id: rtmId,
      logs: messages,
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
};

type ServerOptions = {
  backoff?: number;
  maxWorkflows?: number;
  port?: number;
  lightning?: string; // url to lightning instance
  rtm?: any;
  logger?: Logger;
};

function createServer(rtm: any, options: ServerOptions = {}) {
  const logger = options.logger || createMockLogger();
  const port = options.port || 1234;

  logger.info('Starting server');
  const app = new Koa();

  app.use(bodyParser());
  app.use(
    koaLogger((str, _args) => {
      logger.debug(str);
    })
  );

  const execute = (attempt: Attempt) => {
    const plan = convertAttempt(attempt);
    rtm.execute(plan);
  };

  // TODO actually it's a bit silly to pass everything through, why not just declare the route here?
  // Or maybe I need a central controller/state object
  const apiRouter = createAPI(logger, execute);
  app.use(apiRouter.routes());
  app.use(apiRouter.allowedMethods());

  app.listen(port);
  logger.success('Listening on', port);

  (app as any).destroy = () => {
    // TODO close the work loop
    logger.info('Closing server');
  };

  if (options.lightning) {
    logger.log('Starting work loop at', options.lightning);
    startWorkLoop(options.lightning, rtm.id, execute);
  } else {
    logger.warn('No lightning URL provided');
  }

  rtm.on('workflow-complete', ({ id, state }: { id: string; state: any }) => {
    logger.log(`workflow complete: `, id);
    logger.log(state);
    postResult(rtm.id, options.lightning!, id, state);
  });

  rtm.on('log', ({ id, messages }: { id: string; messages: any[] }) => {
    logger.log(`${id}: `, ...messages);
    postLog(rtm.id, options.lightning!, id, messages);
  });

  // TMP doing this for tests but maybe its better done externally
  app.on = (...args) => rtm.on(...args);
  app.once = (...args) => rtm.once(...args);

  // debug API to run a workflow
  // Used in unit tests
  // Only loads in dev mode?
  // @ts-ignore
  app.execute = execute;

  return app;
}

export default createServer;
