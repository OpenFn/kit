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
import phx from 'phoenix-channels';
import { createMockLogger, Logger } from '@openfn/logger';

import createAPI from './api';
// import startWorkLoop from './work-loop';
import { tryWithBackoff } from './util';
import convertAttempt from './util/convert-attempt';
import { Attempt } from './types';
import { CLAIM } from './events';

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

// this is the websocket API
// basically a router
const createAPI = (ws) => {
  // register events against the socket
};

// This will open up a websocket channel to lightning
// TODO auth
export const connectToLightning = (
  endpoint: string,
  id: string,
  Socket = phx.Socket
) => {
  return new Promise((done) => {
    let socket = new Socket(endpoint /*,{params: {userToken: "123"}}*/);
    socket.connect();

    // join the queue channel
    const channel = socket.channel('attempts:queue');

    channel.join().receive('ok', () => {
      done(channel);
    });
  });
};

// TODO this needs to return some kind of cancel function
export const startWorkloop = (channel, execute, delay = 100) => {
  let promise;
  let cancelled = false;

  const request = () => {
    channel.push(CLAIM).receive('ok', (attempts) => {
      if (!attempts.length) {
        // throw to backoff and try again
        throw new Error('backoff');
      }
      attempts.forEach((attempt) => {
        execute(attempt);
      });
    });
  };

  const workLoop = () => {
    if (!cancelled) {
      promise = tryWithBackoff(request, { timeout: delay });
      // promise.then(workLoop).catch(() => {
      //   // this means the backoff expired
      //   // which right now it won't ever do
      //   // but what's the plan?
      //   // log and try again I guess?
      //   workLoop();
      // });
    }
  };
  workLoop();

  return () => {
    cancelled = true;
    promise.cancel();
  };
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
    connectToLightning(options.lightning, rtm.id);
    //startWorkLoop(options.lightning, rtm.id, execute);
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
