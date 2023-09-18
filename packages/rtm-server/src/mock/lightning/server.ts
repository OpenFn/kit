import { EventEmitter } from 'node:events';
import Koa from 'koa';
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

  // Server setup
  // this seems to setup websockets to work at any path
  // Maybe that's fine for the mock? Kind wierd
  // mind you I still don't get a connect event
  // const app = websockify(new Koa());
  const app = new Koa();
  app.use(bodyParser());

  // this router but doesn't really seem to work
  // app.use(route.all('/websocket', createNewAPI(state, options.port || 8888)));

  // Using routes (seems to not work - at least the api doesn't get)
  // app.ws.use(
  //   route.all('/websocket', (ctx) => createNewAPI(state, ctx.websocket))
  // );

  // this probaably isn;t right because it'll create a new API object
  /// for each request

  const server = app.listen(options.port || 8888);

  createNewAPI(state, '/websocket', server);

  // I really don't think this should be hard
  // we connect to a socket sitting at /socket
  // then we sub to events on both sides

  // app.ws.use(
  //   route.all('/websocket', function (ctx) {
  //     console.log(' >> WEBSOCKET ');
  //     // `ctx` is the regular koa context created from the `ws` onConnection `socket.upgradeReq` object.
  //     // the websocket is added to the context on `ctx.websocket`.
  //     ctx.websocket.send('Hello World');
  //     ctx.websocket.on('message', function (message) {
  //       // do something with the message from client
  //       console.log(message);
  //     });
  //   })
  // );

  const klogger = koaLogger((str) => logger.debug(str));
  app.use(klogger);

  // Mock API endpoints
  app.use(createAPI(state));
  app.use(createDevAPI(app as any, state, logger));

  app.destroy = () => {
    console.log('close');
    server.close();
  };

  return app;
};

export default createLightningServer;
