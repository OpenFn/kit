import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';

import { createMockLogger, Logger } from '@openfn/logger';

import createRestAPI from './api-rest';
import startWorkloop from './api/workloop';
import { execute } from './api/execute';
import joinAttemptChannel from './api/start-attempt';
import connectToLightning from './api/connect';
import { CLAIM_ATTEMPT } from './events';

type ServerOptions = {
  backoff?: number; // what is this?
  maxBackoff?: number;
  maxWorkflows?: number;
  port?: number;
  lightning?: string; // url to lightning instance
  logger?: Logger;

  secret?: string; // worker secret
};

function createServer(engine: any, options: ServerOptions = {}) {
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
  logger.success('ws-worker listening on', port);

  (app as any).destroy = () => {
    // TODO close the work loop
    logger.info('Closing server');
  };

  if (options.lightning) {
    logger.debug('Connecting to Lightning at', options.lightning);
    // TODO this is too hard to unit test, need to pull it out
    connectToLightning(options.lightning, engine.id, options.secret!).then(
      ({ socket, channel }) => {
        logger.success('Connected to Lightning at', options.lightning);

        const startAttempt = async ({ id, token }: CLAIM_ATTEMPT) => {
          const { channel: attemptChannel, plan } = await joinAttemptChannel(
            socket,
            token,
            id,
            logger
          );
          execute(attemptChannel, engine, logger, plan);
        };

        logger.info('Starting workloop');
        // TODO maybe namespace the workloop logger differently? It's a bit annoying
        startWorkloop(channel, startAttempt, logger, {
          maxBackoff: options.maxBackoff,
        });

        // debug/unit test API to run a workflow
        // TODO Only loads in dev mode?
        (app as any).execute = startAttempt;
      }
    );
  } else {
    logger.warn('No lightning URL provided');
  }

  // TMP doing this for tests but maybe its better done externally
  app.on = (...args) => engine.on(...args);
  app.once = (...args) => engine.once(...args);

  return app;
}

export default createServer;
