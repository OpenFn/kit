import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';
import Router from '@koa/router';
import { createMockLogger, Logger } from '@openfn/logger';

import startWorkloop from './api/workloop';
import claim from './api/claim';
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
  noLoop?: boolean; // disable the worker loop

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

  app.listen(port);
  logger.success('ws-worker listening on', port);

  (app as any).destroy = () => {
    // TODO close the work loop
    logger.info('Closing server');
  };

  const router = new Router();
  app.use(router.routes());

  if (options.lightning) {
    logger.debug('Connecting to Lightning at', options.lightning);
    // TODO this is too hard to unit test, need to pull it out
    connectToLightning(options.lightning, engine.id, options.secret!)
      .then(({ socket, channel }) => {
        logger.success('Connected to Lightning at', options.lightning);

        const startAttempt = async ({ id, token }: CLAIM_ATTEMPT) => {
          // TODO need to verify the token against LIGHTNING_PUBLIC_KEY
          const { channel: attemptChannel, plan } = await joinAttemptChannel(
            socket,
            token,
            id,
            logger
          );
          execute(attemptChannel, engine, logger, plan);
        };

        if (!options.noLoop) {
          logger.info('Starting workloop');
          // TODO maybe namespace the workloop logger differently? It's a bit annoying
          startWorkloop(channel, startAttempt, logger, {
            maxBackoff: options.maxBackoff,
            // timeout: 1000 * 60, // TMP debug poll once per minute
          });
        } else {
          logger.break();
          logger.warn('Workloop not starting');
          logger.info('This server will not auto-pull work from lightning.');
          logger.info('You can manually claim by posting to /claim, eg:');
          logger.info(`  curl -X POST http://locahost:${port}/claim`);
          logger.break();
        }

        // debug/unit test API to run a workflow
        // TODO Only loads in dev mode?
        (app as any).execute = startAttempt;

        // Debug API to manually trigger a claim
        router.post('/claim', async (ctx) => {
          logger.info('triggering claim from POST request');
          return claim(channel, startAttempt, logger)
            .then(() => {
              logger.info('claim complete: 1 attempt claimed');
              ctx.body = 'complete';
              ctx.status = 200;
            })
            .catch(() => {
              logger.info('claim complete: no attempts');
              ctx.body = 'no attempts';
              ctx.status = 204;
            });
        });
      })
      .catch((e) => {
        logger.error(
          'CRITICAL ERROR: could not connect to lightning at',
          options.lightning
        );
        logger.debug(e);
        process.exit(1);
      });
  } else {
    logger.warn('No lightning URL provided');
  }

  // TMP doing this for tests but maybe its better done externally
  app.on = (...args) => engine.on(...args);
  app.once = (...args) => engine.once(...args);

  return app;
}

export default createServer;
