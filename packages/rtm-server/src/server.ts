import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';

import { createMockLogger, Logger } from '@openfn/logger';

import createRestAPI from './api-rest';
import startWorkloop from './api/workloop';
import { execute } from './api/execute';
import joinAttemptChannel from './api/start-attempt';
import connectToLightning from './api/connect';

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

  type StartAttemptArgs = {
    id: string;
    token: string;
  };

  if (options.lightning) {
    logger.log('Starting work loop at', options.lightning);
    connectToLightning(options.lightning, rtm.id).then(
      ({ socket, channel }) => {
        const startAttempt = async ({ id, token }: StartAttemptArgs) => {
          const { channel: attemptChannel, plan } = await joinAttemptChannel(
            socket,
            token,
            id
          );
          execute(attemptChannel, rtm, plan);
        };

        // TODO maybe pull this logic out so we can test it?
        startWorkloop(channel, startAttempt);

        // debug/unit test API to run a workflow
        // TODO Only loads in dev mode?
        (app as any).execute = startAttempt;
      }
    );
  } else {
    logger.warn('No lightning URL provided');
  }

  // TMP doing this for tests but maybe its better done externally
  app.on = (...args) => rtm.on(...args);
  app.once = (...args) => rtm.once(...args);

  return app;
}

export default createServer;
