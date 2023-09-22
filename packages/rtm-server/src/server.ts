import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';
import phx from 'phoenix-channels';
import { createMockLogger, Logger } from '@openfn/logger';

import createRestAPI from './api-rest';
import convertAttempt from './util/convert-attempt';
import startWorkloop from './api/workloop';
import { execute, prepareAttempt } from './api/execute';

type ServerOptions = {
  backoff?: number;
  maxWorkflows?: number;
  port?: number;
  lightning?: string; // url to lightning instance
  rtm?: any;
  logger?: Logger;
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

function createServer(rtm: any, options: ServerOptions = {}) {
  const logger = options.logger || createMockLogger();
  const port = options.port || 1234;

  logger.debug('Starting server');

  const app = new Koa();

  app.use(bodyParser());
  app.use(
    koaLogger((str, _args) => {
      logger.debug(str);
    })
  );

  createRestAPI(app, logger);

  app.listen(port);
  logger.success('RTM server listening on', port);

  (app as any).destroy = () => {
    // TODO close the work loop
    logger.info('Closing server');
  };

  const handleAttempt = async (channel, attempt) => {
    const plan = await prepareAttempt(attempt);
    execute(channel, rtm, plan);
  };

  if (options.lightning) {
    logger.log('Starting work loop at', options.lightning);
    connectToLightning(options.lightning, rtm.id).then((channel) => {
      // TODO maybe pull this logic out so we can test it?
      startWorkloop(channel, (attempt) => {
        handleAttempt(channel, attempt);
      });

      // debug API to run a workflow
      // Used in unit tests
      // Only loads in dev mode?
      // @ts-ignore
      app.execute = (attempt) => {
        handleAttempt(channel, attempt);
      };
    });
  } else {
    logger.warn('No lightning URL provided');
  }

  // rtm.on('workflow-complete', ({ id, state }: { id: string; state: any }) => {
  //   logger.log(`workflow complete: `, id);
  //   logger.log(state);
  //   postResult(rtm.id, options.lightning!, id, state);
  // });

  // rtm.on('log', ({ id, messages }: { id: string; messages: any[] }) => {
  //   logger.log(`${id}: `, ...messages);
  //   postLog(rtm.id, options.lightning!, id, messages);
  // });

  // TMP doing this for tests but maybe its better done externally
  app.on = (...args) => rtm.on(...args);
  app.once = (...args) => rtm.once(...args);

  return app;
}

export default createServer;
