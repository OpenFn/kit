import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';
import Router from '@koa/router';
import { humanId } from 'human-id';
import { createMockLogger, Logger } from '@openfn/logger';
import { RuntimeEngine } from '@openfn/engine-multi';

import startWorkloop from './api/workloop';
import claim from './api/claim';
import { execute } from './api/execute';
import joinAttemptChannel from './channels/attempt';
import connectToWorkerQueue from './channels/worker-queue';
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

// this is the server/koa API
interface ServerApp extends Koa {
  id: string;
  socket: any;
  channel: any;

  execute: ({ id, token }: CLAIM_ATTEMPT) => Promise<void>;
  destroy: () => void;
  killWorkloop: () => void;
}

const DEFAULT_PORT = 1234;

// TODO move out into another file, make testable
function connect(
  app: ServerApp,
  engine: RuntimeEngine,
  logger: Logger,
  options: ServerOptions = {}
) {
  logger.debug('Connecting to Lightning at', options.lightning);

  connectToWorkerQueue(options.lightning!, engine.id, options.secret!)
    .then(({ socket, channel }) => {
      logger.success('Connected to Lightning at', options.lightning);

      // save the channel and socket
      app.socket = socket;
      app.channel = channel;

      // trigger the workloop
      if (!options.noLoop) {
        logger.info('Starting workloop');
        // TODO maybe namespace the workloop logger differently? It's a bit annoying
        app.killWorkloop = startWorkloop(channel, app.execute, logger, {
          maxBackoff: options.maxBackoff,
          // timeout: 1000 * 60, // TMP debug poll once per minute
        });
      } else {
        logger.break();
        logger.warn('Workloop not starting');
        logger.info('This server will not auto-pull work from lightning.');
        logger.info('You can manually claim by posting to /claim, eg:');
        logger.info(
          `  curl -X POST http://locahost:${options.port || DEFAULT_PORT}/claim`
        );
        logger.break();
      }
    })
    .catch((e) => {
      logger.error(
        'CRITICAL ERROR: could not connect to lightning at',
        options.lightning
      );
      logger.debug(e);

      app.killWorkloop?.();

      // Try to Reconnect after 10 seconds
      setTimeout(() => {
        connect(app, engine, logger, options);
      }, 1e4);
    });
}

function createServer(engine: RuntimeEngine, options: ServerOptions = {}) {
  const logger = options.logger || createMockLogger();
  const port = options.port || DEFAULT_PORT;

  logger.debug('Starting server');

  const app = new Koa() as ServerApp;
  app.id = humanId({ separator: '-', capitalize: false });
  const router = new Router();

  app.use(bodyParser());
  app.use(
    koaLogger((str, _args) => {
      logger.debug(str);
    })
  );

  const server = app.listen(port);
  logger.success(`ws-worker ${app.id} listening on ${port}`);

  // TODO this probably needs to move into ./api/ somewhere
  app.execute = async ({ id, token }: CLAIM_ATTEMPT) => {
    if (app.socket) {
      // TODO need to verify the token against LIGHTNING_PUBLIC_KEY
      const {
        channel: attemptChannel,
        plan,
        options,
      } = await joinAttemptChannel(app.socket, token, id, logger);
      execute(attemptChannel, engine, logger, plan, options);
    } else {
      logger.error('No lightning socket established');
      // TODO something else. Throw? Emit?
    }
  };

  // Debug API to manually trigger a claim
  router.post('/claim', async (ctx) => {
    logger.info('triggering claim from POST request');
    return claim(app.channel, app.execute, logger)
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

  app.destroy = () => {
    logger.info('Closing server...');
    server.close();
    app.killWorkloop?.();
    logger.success('Server closed');
  };

  app.use(router.routes());

  if (options.lightning) {
    connect(app, engine, logger, options);
  } else {
    logger.warn('No lightning URL provided');
  }

  // TMP doing this for tests but maybe its better done externally?
  // @ts-ignore
  app.on = (...args) => {
    return engine.on(...args);
  };

  return app;
}

export default createServer;
