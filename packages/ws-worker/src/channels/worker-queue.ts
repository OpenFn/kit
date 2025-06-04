import EventEmitter from 'node:events';
import * as Sentry from '@sentry/node';
import { Socket as PhxSocket } from 'phoenix';
import { WebSocket } from 'ws';
import { API_VERSION } from '@openfn/lexicon/lightning';
import generateWorkerToken from '../util/worker-token';
import getVersion from '../util/load-version';

import type { Logger } from '@openfn/logger';
import type { Channel } from '../types';

const connectToWorkerQueue = (
  endpoint: string,
  serverId: string,
  secret: string,
  timeout: number = 10,
  logger: Logger,
  SocketConstructor = PhxSocket
) => {
  const events = new EventEmitter();
  Sentry.addBreadcrumb({
    category: 'lifecycle',
    message: 'Connecting to worker queue',
    level: 'info',
  });
  generateWorkerToken(secret, serverId, logger).then(async (token) => {
    Sentry.addBreadcrumb({
      category: 'lifecycle',
      message: 'Worker token generated',
      level: 'info',
    });

    const params = {
      token,
      api_version: API_VERSION,
      worker_version: await getVersion(),
    };

    // @ts-ignore ts doesn't like the constructor here at all
    const socket = new SocketConstructor(endpoint, {
      params,
      transport: WebSocket,
      timeout: timeout * 1000,
      reconnectAfterMs: (tries) => Math.max(tries * 1000),
    });

    let didOpen = false;
    let shouldReportConnectionError = true;

    socket.onOpen(() => {
      Sentry.addBreadcrumb({
        category: 'lifecycle',
        message: 'Web socket connected',
        level: 'info',
      });

      didOpen = true;
      shouldReportConnectionError = true;

      const channel = socket.channel('worker:queue') as Channel;

      channel.onMessage = (ev, load) => {
        events.emit('message', ev, load);
        return load;
      };

      channel
        .join()
        .receive('ok', () => {
          logger.debug('Connected to worker queue socket');
          events.emit('connect', { socket, channel });
        })
        .receive('error', (e: any) => {
          logger.error('ERROR', e);
        })
        .receive('timeout', (e: any) => {
          logger.error('TIMEOUT', e);
        });
    });

    // On close, the socket will try and reconnect itself
    // Forever, so far as I can tell
    socket.onClose((_e: any) => {
      logger.debug('queue socket closed');
      events.emit('disconnect');
    });

    // if we fail to connect, the socket will try to reconnect
    // forever (?) with backoff - see reconnectAfterMs
    socket.onError((e: any) => {
      Sentry.addBreadcrumb({
        category: 'lifecycle',
        message: 'Error in web socket connection',
        level: 'info',
      });

      if (shouldReportConnectionError) {
        logger.debug('Reporting connection error to sentry');
        shouldReportConnectionError = false;
        Sentry.captureException(e);
      }

      if (!didOpen) {
        events.emit('error', e.message);
        didOpen = false;
      }
    });

    socket.connect();
  });

  return events;
};

export default connectToWorkerQueue;
