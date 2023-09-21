import { EventEmitter } from 'node:events';
import Koa from 'koa';
import URL from 'node:url';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';
import websockify from 'koa-websocket';
import route from 'koa-route';
import createLogger, {
  createMockLogger,
  LogLevel,
  Logger,
} from '@openfn/logger';

import createServer from './socket-server';
import createAPI from './api';
import createWebSocketAPI from './api-sockets';
import createDevAPI from './api-dev';
import { Attempt } from '../../types';

export const API_PREFIX = '/api/1';

export type ServerState = {
  credentials: Record<string, any>;
  attempts: Record<string, any>;
  queue: Attempt[];
  results: Record<string, { rtmId: string; state: null | any }>;
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
    // list of credentials by id
    credentials: {},
    // list of events by id
    attempts: {},

    // list of dataclips by id
    dataclips: {},

    // attempts which have been started
    // probaby need to track status and maybe the rtm id?
    // TODO maybe Active is a better word?
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

  // Setup the websocket API
  const api = createWebSocketAPI(
    state,
    '/api',
    server,
    options.logger && logger
  );

  // Only create a http logger if there's a top-level logger passed
  // This is a bit flaky really but whatever
  if (options.logger) {
    const httpLogger = createLogger('HTTP', { level: 'debug' });
    const klogger = koaLogger((str) => httpLogger.debug(str));
    app.use(klogger);
  }

  // Mock API endpoints
  // TODO should we keep the REST interface for local debug?
  // Maybe for the read-only stuff (like get all attempts)
  // app.use(createAPI(state));
  app.use(createDevAPI(app as any, state, logger, api));

  app.destroy = () => {
    server.close();
  };

  return app;
};

export default createLightningServer;
