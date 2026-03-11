import { EventEmitter } from 'node:events';

import { promisify } from 'node:util';
import { exec as _exec } from 'node:child_process';

import * as Sentry from '@sentry/node';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';
import Router from '@koa/router';
import { humanId } from 'human-id';
import { createMockLogger, Logger } from '@openfn/logger';
import { ClaimRun } from '@openfn/lexicon/lightning';
import {
  INTERNAL_RUN_COMPLETE,
  INTERNAL_SOCKET_READY,
  WORK_AVAILABLE,
} from './events';
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
import { convertRun } from './util';
import type { RuntimeSlotGroup } from './util/parse-queues';
import {
  createRuntimeGroup,
  groupHasCapacity,
  SlotGroup,
} from './util/parse-queues';

const exec = promisify(_exec);

export type ServerOptions = {
  batchLogs?: boolean;
  batchInterval?: number;
  batchLimit?: number;
  maxWorkflows?: number;
  slotGroups?: SlotGroup[];
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

  sentryDsn?: string;
  sentryEnv?: string;

  socketTimeoutSeconds?: number; // deprecated
  messageTimeoutSeconds?: number;
  claimTimeoutSeconds?: number;
  payloadLimitMb?: number; // max memory limit for socket payload (ie, step:complete, log)
  logPayloadLimitMb?: number; // max memory limit for log payloads specifically
  collectionsVersion?: string;
  collectionsUrl?: string;
  monorepoDir?: string;

  timeoutRetryCount?: number;
  timeoutRetryDelayMs?: number;
};

// this is the server/koa API
export interface ServerApp extends Koa {
  id: string;
  socket?: any;
  queueChannel?: Channel;
  workflows: Record<string, true | Context>;
  openClaims: Record<string, number>;
  destroyed: boolean;
  events: EventEmitter;
  server: Server;
  engine: RuntimeEngine;
  options: ServerOptions;

  slotGroups: RuntimeSlotGroup[];
  runGroupMap: Record<string, RuntimeSlotGroup>;

  execute: ({ id, token }: ClaimRun) => Promise<void>;
  destroy: () => void;
  resumeWorkloop: (group?: RuntimeSlotGroup) => void;

  // debug API
  claim: () => Promise<any>;
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
    if (options.noLoop) {
      // @ts-ignore
      const port = app.server?.address().port;
      logger.break();
      logger.warn('Noloop active: workloop has not started');
      logger.info('This server will not auto-pull work from lightning.');
      logger.info('You can manually claim by posting to /claim, eg:');
      logger.info(`  curl -X POST http://localhost:${port}/claim`);
      logger.break();
    }

    app.events.emit(INTERNAL_SOCKET_READY);
    app.resumeWorkloop();
  };

  // We were disconnected from the queue
  const onDisconnect = () => {
    for (const g of app.slotGroups) {
      if (g.workloop && !g.workloop.isStopped()) {
        g.workloop.stop('Socket disconnected unexpectedly');
      }
    }
    if (!app.destroyed) {
      logger.info('Connection to lightning lost');
      logger.info(
        'Worker will automatically reconnect when lightning is back online'
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

    // How to prevent spam here?
  };

  // handles messages for the worker:queue
  const onMessage = (event: string) => {
    if (event === WORK_AVAILABLE) {
      if (!app.destroyed) {
        for (const g of app.slotGroups) {
          if (groupHasCapacity(g)) {
            claim(app, logger, g).catch(() => {
              // do nothing - it's fine if claim throws here
            });
          }
        }
      }
    }
  };

  // Build queues map from slot groups: key = queues joined by comma, value = maxSlots
  const queuesMap: Record<string, number> = {};
  for (const g of app.slotGroups) {
    queuesMap[g.queues.join(',')] = g.maxSlots;
  }

  connectToWorkerQueue(options.lightning!, app.id, options.secret!, logger, {
    // TODO: options.socketTimeoutSeconds wins because this is what USED to be used
    // But it's deprecated and should be removed soon
    messageTimeout:
      options.socketTimeoutSeconds ?? options.messageTimeoutSeconds,
    claimTimeout: options.claimTimeoutSeconds,
    capacity: options.maxWorkflows,
    queues: queuesMap,
  })
    .on('connect', onConnect)
    .on('disconnect', onDisconnect)
    .on('error', onError)
    .on('message', onMessage);
}

async function setupCollections(options: ServerOptions, logger: Logger) {
  if (options.collectionsUrl) {
    logger.log('Using collections endpoint at ', options.collectionsUrl);
  } else {
    logger.warn(
      'WARNING: no collections URL provided. Collections service will not be enabled.'
    );
    logger.warn(
      'Pass --collections-url or set WORKER_COLLECTIONS_URL to set the url'
    );
    return;
  }

  if (options.collectionsVersion && options.collectionsVersion !== 'latest') {
    logger.log(
      'Using collections version from CLI/env: ',
      options.collectionsVersion
    );
    return options.collectionsVersion;
  }
  const { stdout: version } = await exec(
    'npm view @openfn/language-collections@latest version'
  );
  logger.log('Using collections version from @latest: ', version);
  return version.trim();
}

function createServer(engine: RuntimeEngine, options: ServerOptions = {}) {
  const logger = options.logger || createMockLogger();
  const port = options.port || DEFAULT_PORT;

  const app = new Koa() as ServerApp;
  app.id = humanId({ separator: '-', capitalize: false });
  const router = new Router();

  app.events = new EventEmitter();
  app.engine = engine;

  if (options.sentryDsn) {
    // TODO I think we need to set up sourcemaps
    // https://docs.sentry.io/platforms/javascript/guides/koa/sourcemaps/uploading/esbuild/
    // TODO warn if no API key
    Sentry.init({
      environment: options.sentryEnv,
      dsn: options.sentryDsn,
    });
    Sentry.setupKoaErrorHandler(app);
  }

  app.use(bodyParser());
  app.use(
    koaLogger((str, _args) => {
      logger.debug(str);
    })
  );

  app.openClaims = {};
  app.workflows = {};
  app.destroyed = false;

  // Initialize slot groups: use provided slotGroups, or create a single default group
  const slotGroupDefs: SlotGroup[] = options.slotGroups ?? [
    { queues: ['manual', '*'], maxSlots: options.maxWorkflows ?? 5 },
  ];
  app.slotGroups = slotGroupDefs.map(createRuntimeGroup);
  app.runGroupMap = {};

  app.server = app.listen(port);
  logger.success(`Worker ${app.id} listening on ${port}`);

  process.send?.('READY');

  router.get('/livez', healthcheck);

  router.get('/', healthcheck);

  app.options = options;

  // Start the workloop for a specific group (or all groups if none specified)
  // When called with a specific group (e.g. after a run completes), we restart
  // the workloop fresh so it claims immediately rather than waiting in backoff.
  app.resumeWorkloop = (group?: RuntimeSlotGroup) => {
    if (options.noLoop || app.destroyed) {
      return;
    }

    const groups = group ? [group] : app.slotGroups;
    for (const g of groups) {
      if (!groupHasCapacity(g)) {
        continue;
      }
      // Stop any existing workloop so we can start fresh with immediate claim
      if (g.workloop && !g.workloop.isStopped()) {
        g.workloop.stop('restarting');
      }
      logger.info(`Starting workloop for group ${g.id}`);
      g.workloop = startWorkloop(
        app,
        logger,
        options.backoff?.min || MIN_BACKOFF,
        options.backoff?.max || MAX_BACKOFF,
        g
      );
    }
  };

  // TODO this probably needs to move into ./api/ somewhere
  app.execute = async ({ id, token }: ClaimRun) => {
    if (app.socket) {
      try {
        const start = Date.now();
        app.workflows[id] = true;

        const { channel: runChannel, run } = await joinRunChannel(
          app.socket,
          token,
          id,
          logger,
          app.options.messageTimeoutSeconds
        );

        const { plan, options, input } = convertRun(run, {
          collectionsVersion: app.options.collectionsVersion,
          monorepoPath: app.options.monorepoDir,
        });
        //logger.debug('converted run body into execution plan:', plan);

        // Setup collections
        if (plan.workflow.credentials?.collections_token) {
          plan.workflow.credentials.collections_token = token;
        }
        if (plan.workflow.credentials?.collections_endpoint) {
          plan.workflow.credentials.collections_endpoint =
            app.options.collectionsUrl;
        }

        // Default the payload limit if it's not otherwise set on the run options
        if (!('payloadLimitMb' in options)) {
          options.payloadLimitMb = app.options.payloadLimitMb;
        }
        // Default the log payload limit if it's not otherwise set on the run options
        if (!('logPayloadLimitMb' in options)) {
          options.logPayloadLimitMb = app.options.logPayloadLimitMb;
        }

        options.timeoutRetryCount = app.options.timeoutRetryCount;
        options.timeoutRetryDelay =
          app.options.timeoutRetryDelayMs ?? app.options.socketTimeoutSeconds;
        options.eventTimeoutSeconds = app.options.messageTimeoutSeconds;
        options.batchLogs = app.options.batchLogs;
        options.batchInterval = app.options.batchInterval;
        options.batchLimit = app.options.batchLimit;

        // Callback to be triggered when the work is done (including errors)
        const onFinish = () => {
          const duration = (Date.now() - start) / 1000;
          logger.debug(
            `workflow ${id} complete in ${duration}s: releasing worker`
          );
          delete app.workflows[id];
          runChannel.leave();

          // Remove from owning group and resume its workloop
          const owningGroup = app.runGroupMap[id];
          if (owningGroup) {
            owningGroup.activeRuns.delete(id);
            delete app.runGroupMap[id];
            app.events.emit(INTERNAL_RUN_COMPLETE);
            app.resumeWorkloop(owningGroup);
          } else {
            app.events.emit(INTERNAL_RUN_COMPLETE);
            app.resumeWorkloop();
          }
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
      } catch (e) {
        delete app.workflows[id];

        // Clean up from owning group
        const owningGroup = app.runGroupMap[id];
        if (owningGroup) {
          owningGroup.activeRuns.delete(id);
          delete app.runGroupMap[id];
          app.resumeWorkloop(owningGroup);
        } else {
          app.resumeWorkloop();
        }

        // Trap errors coming out of the socket
        // These are likely to be comms errors with Lightning
        logger.error(`Unexpected error executing ${id}`);
        logger.error(e);
      }
    } else {
      logger.error('No lightning socket established');
      // TODO something else. Throw? Emit?
    }
  };

  // Debug API to manually trigger a claim on all groups with capacity
  router.post('/claim', async (ctx) => {
    logger.info('triggering claim from POST request');
    const promises = app.slotGroups.map((g) => {
      if (groupHasCapacity(g)) {
        return claim(app, logger, g);
      }
      return Promise.reject(new Error('Group at capacity'));
    });
    return Promise.any(promises)
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

  app.claim = () => {
    const promises = app.slotGroups.map((g) => {
      if (groupHasCapacity(g)) {
        return claim(app, logger, g);
      }
      return Promise.reject(new Error('Group at capacity'));
    });
    return Promise.any(promises);
  };

  app.destroy = () => destroy(app, logger);

  app.use(router.routes());

  if (options.lightning) {
    setupCollections(options, logger).then((version) => {
      app.options.collectionsVersion = version;
      connect(app, logger, options);
    });
  } else {
    logger.warn('No lightning URL provided');
  }

  let shutdown = false;

  const exit = async (signal: string) => {
    if (!shutdown) {
      shutdown = true;
      logger.always(`${signal} RECEIVED: CLOSING SERVER`);
      await app.destroy();
      process.exit(0);
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
