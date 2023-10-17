import { EventEmitter } from 'node:events';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';
import createLogger, {
  createMockLogger,
  LogLevel,
  Logger,
} from '@openfn/logger';

import createWebSocketAPI from './api-sockets';
import createDevAPI from './api-dev';
import { Attempt } from './types';
import { AttemptLogPayload } from './events';

export type AttemptState = {
  status: 'queued' | 'started' | 'complete';
  logs: AttemptLogPayload[];
};

export type ServerState = {
  queue: AttemptId[];

  // list of credentials by id
  credentials: Record<string, any>;

  // list of attempts by id
  attempts: Record<string, Attempt>;

  // list of dataclips by id
  dataclips: Record<string, any>;

  // Tracking state of known attempts
  // TODO include the engine id and token
  pending: Record<string, AttemptState>;

  // Track all completed attempts here
  results: Record<string, { workerId: string; state: null | any }>;

  // event emitter for debugging and observability
  events: EventEmitter;
};

export type LightningOptions = {
  logger?: Logger;
  logLevel?: LogLevel;
  port?: string | number;
};

export type AttemptId = string;

// a mock lightning server
const createLightningServer = (options: LightningOptions = {}) => {
  const logger = options.logger || createMockLogger();

  const state = {
    credentials: {},
    attempts: {},
    dataclips: {},
    pending: {},

    queue: [] as AttemptId[],
    results: {},
    events: new EventEmitter(),
  } as ServerState;

  const app = new Koa();
  app.use(bodyParser());

  const port = options.port || 8888;
  const server = app.listen(port);
  logger.info('Listening on ', port);

  // Only create a http logger if there's a top-level logger passed
  // This is a bit flaky really but whatever
  if (options.logger) {
    const httpLogger = createLogger('HTTP', { level: 'debug' });
    const klogger = koaLogger((str) => httpLogger.debug(str));
    app.use(klogger);
  }

  // Setup the websocket API
  const api = createWebSocketAPI(
    state,
    '/worker', // TODO I should option drive this
    server,
    options.logger && logger
  );

  app.use(createDevAPI(app as any, state, logger, api));

  (app as any).destroy = () => {
    server.close();
  };

  return app;
};

export default createLightningServer;
