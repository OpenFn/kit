import { EventEmitter } from 'node:events';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';
import Router from '@koa/router';
import { humanId } from 'human-id';
import { createMockLogger, Logger } from '@openfn/logger';
import { ClaimRun } from '@openfn/lexicon/lightning';
import { INTERNAL_RUN_COMPLETE } from './events';
import destroy from './api/destroy';
import startWorkloop from './api/workloop';
import claim from './api/claim';
import { Context, execute } from './api/execute';
import healthcheck from './middleware/healthcheck';
import joinRunChannel from './channels/run';
import connectToWorkerQueue from './channels/worker-queue';

import type { Server } from 'http';
import type { RuntimeEngine } from '@openfn/engine-multi';
import type { Socket, Channel } from './types';

export type ServerOptions = {
  maxWorkflows?: number;
  port?: number;
  lightning?: string; // url to lightning instance
  logger?: Logger;
  noLoop?: boolean; // disable the worker loop

  secret?: string; // worker secret
  runPublicKey?: string; // base64 encoded run public key

  backoff?: {
    min?: number;
    max?: number;
  };

  socketTimeoutSeconds?: number;
  payloadLimitMb?: number; // max memory limit for socket payload (ie, step:complete, log)
};

// this is the server/koa API
export interface ServerApp extends Koa {
  id: string;
  socket?: any;
  queueChannel?: Channel;
  workflows: Record<string, true | Context>;
  destroyed: boolean;
  events: EventEmitter;
  server: Server;
  engine: RuntimeEngine;
  options: ServerOptions;

  execute: ({ id, token }: ClaimRun) => Promise<void>;
  destroy: () => void;
  killWorkloop?: () => void;
}

type SocketAndChannel = {
  socket: Socket;
  channel: Channel;
};

const DEFAULT_PORT = 2222;
const MIN_BACKOFF = 1000;
const MAX_BACKOFF = 1000 * 30;

// TODO move out into another file, make testable, test in isolation
function connect(app: ServerApp, logger: Logger, options: ServerOptions = {}) {
  logger.debug('Connecting to Lightning at', options.lightning);

  // A new connection made to the queue
  const onConnect = ({ socket, channel }: SocketAndChannel) => {
    if (app.destroyed) {
      // Fix an edge case where a server can be destroyed before it is
      // even connnected
      // If this has happened, we do NOT want to go and start the workloop!
      return;
    }
    logger.success('Connected to Lightning at', options.lightning);

    // save the channel and socket
    app.socket = socket;
    app.queueChannel = channel;

    // trigger the workloop
    if (!options.noLoop) {
      logger.info('Starting workloop');
      // TODO maybe namespace the workloop logger differently? It's a bit annoying
      app.killWorkloop = startWorkloop(
        app,
        logger,
        options.backoff?.min || MIN_BACKOFF,
        options.backoff?.max || MAX_BACKOFF,
        options.maxWorkflows
      );
    } else {
      // @ts-ignore
      const port = app.server?.address().port;
      logger.break();
      logger.warn('Noloop active: workloop has not started');
      logger.info('This server will not auto-pull work from lightning.');
      logger.info('You can manually claim by posting to /claim, eg:');
      logger.info(`  curl -X POST http://localhost:${port}/claim`);
      logger.break();
    }
  };

  // We were disconnected from the queue
  const onDisconnect = () => {
    if (app.killWorkloop) {
      app.killWorkloop();
      delete app.killWorkloop;
      logger.info('Connection to lightning lost.');
      logger.info(
        'Worker will automatically reconnect when lightning is back online.'
      );
      // So far as I know, the socket will try and reconnect in the background forever
    }
  };

  // We failed to connect to the queue
  const onError = (e: any) => {
    if (app.destroyed) {
      return;
    }

    logger.error(
      'CRITICAL ERROR: could not connect to lightning at',
      options.lightning
    );
    logger.debug(e);
  };

  connectToWorkerQueue(
    options.lightning!,
    app.id,
    options.secret!,
    options.socketTimeoutSeconds,
    logger
  )
    .on('connect', onConnect)
    .on('disconnect', onDisconnect)
    .on('error', onError);
}

function createServer(engine: RuntimeEngine, options: ServerOptions = {}) {
  const logger = options.logger || createMockLogger();
  const port = options.port || DEFAULT_PORT;

  const app = new Koa() as ServerApp;
  app.id = humanId({ separator: '-', capitalize: false });
  const router = new Router();

  app.events = new EventEmitter();
  app.engine = engine;

  app.use(bodyParser());
  app.use(
    koaLogger((str, _args) => {
      logger.debug(str);
    })
  );

  app.workflows = {};
  app.destroyed = false;

  app.server = app.listen(port);
  logger.success(`Worker ${app.id} listening on ${port}`);

  process.send?.('READY');

  router.get('/livez', healthcheck);

  router.get('/', healthcheck);

  app.options = options;

  // TODO this probably needs to move into ./api/ somewhere
  app.execute = async ({ id, token }: ClaimRun) => {
    if (app.socket) {
      app.workflows[id] = true;

      const {
        channel: runChannel,
        plan,
        options = {},
        input,
      } = await joinRunChannel(app.socket, token, id, logger);

      // Default the payload limit if it's not otherwise set on the run options
      if (!('payloadLimitMb' in options)) {
        options.payloadLimitMb = app.options.payloadLimitMb;
      }

      // Callback to be triggered when the work is done (including errors)
      const onFinish = () => {
        logger.debug(`workflow ${id} complete: releasing worker`);
        delete app.workflows[id];
        runChannel.leave();

        app.events.emit(INTERNAL_RUN_COMPLETE);
      };
      const context = execute(
        runChannel,
        engine,
        logger,
        plan,
        input,
        options,
        onFinish
      );

      app.workflows[id] = context;
    } else {
      logger.error('No lightning socket established');
      // TODO something else. Throw? Emit?
    }
  };

  // Debug API to manually trigger a claim
  router.post('/claim', async (ctx) => {
    logger.info('triggering claim from POST request');
    return claim(app, logger, {
      maxWorkers: options.maxWorkflows,
    })
      .then(() => {
        logger.info('claim complete: 1 run claimed');
        ctx.body = 'complete';
        ctx.status = 200;
      })
      .catch(() => {
        logger.info('claim complete: no runs');
        ctx.body = 'no runs';
        ctx.status = 204;
      });
  });

  app.destroy = () => destroy(app, logger);

  app.use(router.routes());

  if (options.lightning) {
    connect(app, logger, options);
  } else {
    logger.warn('No lightning URL provided');
  }

  let shutdown = false;

  const exit = async (signal: string) => {
    if (!shutdown) {
      shutdown = true;
      logger.always(`${signal} RECEIVED: CLOSING SERVER`);
      await app.destroy();
      process.exit();
    }
  };

  process.on('SIGINT', () => exit('SIGINT'));
  process.on('SIGTERM', () => exit('SIGTERM'));

  // TMP doing this for tests but maybe its better done externally?
  // @ts-ignore
  app.on = (...args) => {
    // @ts-ignore
    return engine.on(...args);
  };

  return app;
}

export default createServer;
