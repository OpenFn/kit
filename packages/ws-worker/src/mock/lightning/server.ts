import { EventEmitter } from 'node:events';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';
import createLogger, {
  createMockLogger,
  LogLevel,
  Logger,
  JSONLog,
} from '@openfn/logger';

import createWebSocketAPI from './api-sockets';
import createDevAPI from './api-dev';

export const API_PREFIX = '/api/1';

export type AttemptState = {
  status: 'queued' | 'started' | 'complete';
  logs: JSONLog[];
};

export type ServerState = {
  queue: AttemptId[];

  // list of credentials by id
  credentials: Record<string, any>;

  // list of events by id
  attempts: Record<string, any>;

  // list of dataclips by id
  dataclips: Record<string, any>;

  // Tracking state of known attempts
  // TODO include the rtm id and token
  pending: Record<string, AttemptState>;

  // Track all completed attempts here
  results: Record<string, { rtmId: string; state: null | any }>;

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
    '/api',
    server,
    options.logger && logger
  );

  app.use(createDevAPI(app as any, state, logger, api));

  app.destroy = () => {
    server.close();
  };

  return app;
};

export default createLightningServer;