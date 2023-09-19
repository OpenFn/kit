import { EventEmitter } from 'node:events';
import Koa from 'koa';
import URL from 'node:url';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';
import websockify from 'koa-websocket';
import route from 'koa-route';
import { createMockLogger, LogLevel, Logger } from '@openfn/logger';

import createServer from './socket-server';
import createAPI, { createNewAPI } from './api';
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

  const server = app.listen(options.port || 8888);

  // Setup the websocket API
  const api = createNewAPI(state, '/api', server);

  const klogger = koaLogger((str) => logger.debug(str));
  app.use(klogger);

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
