import { EventEmitter } from 'node:events';
import Koa from 'koa';
import URL from 'node:url';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';
import websockify from 'koa-websocket';
import route from 'koa-route';
import { createMockLogger, LogLevel, Logger } from '@openfn/logger';

import createServer from '../socket-server';
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

// a mock lightning server
const createLightningServer = (options: LightningOptions = {}) => {
  const logger = options.logger || createMockLogger();

  // App state websockify = require('koa-websocket');
  const state = {
    credentials: {},
    attempts: [],

    // TODO for now, the queue will hold the actual Attempt data directly
    // I think later we want it to just hold an id?
    queue: [] as Attempt[],
    results: {},
    events: new EventEmitter(),
  } as ServerState;

  const app = new Koa();
  app.use(bodyParser());

  const server = app.listen(options.port || 8888);

  // Setup the websocket API
  createNewAPI(state, '/api', server);

  const klogger = koaLogger((str) => logger.debug(str));
  app.use(klogger);

  // Mock API endpoints
  // app.use(createAPI(state));
  app.use(createDevAPI(app as any, state, logger));

  app.destroy = () => {
    console.log('close');
    server.close();
  };

  return app;
};

export default createLightningServer;
