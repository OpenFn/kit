/**
 * This module creates a mock pheonix socket server
 * It uses a standard ws server but wraps messages up in a
 * structure that pheonix sockets can understand
 * It also adds some dev and debug APIs, useful for unit testing
 */
import { WebSocketServer, WebSocket } from 'ws';

import { ATTEMPT_PREFIX, extractAttemptId } from './util';
import { ServerState } from './server';

import type { Logger } from '@openfn/logger';

type Topic = string;

export type PhoenixEventStatus = 'ok' | 'error' | 'timeout';

// websocket with a couple of dev-friendly APIs
export type DevSocket = WebSocket & {
  reply: <R = any>(evt: PhoenixReply<R>) => void;
  sendJSON: ({ event, topic, ref }: PhoenixEvent) => void;
};

export type PhoenixEvent<P = any> = {
  topic: Topic;
  event: string;
  payload: P;
  ref: string;
};

export type PhoenixReply<R = any> = {
  topic: Topic;
  payload: {
    status: PhoenixEventStatus;
    response?: R;
  };
  ref: string;
};

type EventHandler = (ws: DevSocket, event: PhoenixEvent) => void;

type CreateServerOptions = {
  port?: number;
  server: typeof WebSocketServer;
  state: ServerState;
  logger?: Logger;
  onMessage?: (evt: PhoenixEvent) => void;
};

type MockSocketServer = typeof WebSocketServer & {
  // Dev/debug APIs
  listenToChannel: (
    topic: Topic,
    fn: EventHandler
  ) => { unsubscribe: () => void };
  waitForMessage: (topic: Topic, event: string) => Promise<PhoenixEvent>;
  registerEvents: (
    topic: Topic,
    events: Record<string, EventHandler>
  ) => { unsubscribe: () => void };
};

function createServer({
  port = 8080,
  server,
  state,
  logger,
  onMessage = () => {},
}: CreateServerOptions) {
  logger?.info('pheonix mock websocket server listening on', port);
  const channels: Record<Topic, Set<EventHandler>> = {};

  const wsServer =
    server ||
    new WebSocketServer({
      port,
    });

  const events = {
    // testing (TODO shouldn't this be in a specific channel?)
    ping: (ws: DevSocket, { topic, ref }: PhoenixEvent) => {
      ws.sendJSON({
        topic,
        ref,
        event: 'pong',
        payload: {},
      });
    },
    // When joining a channel, we need to send a chan_reply_{ref} message back to the socket
    phx_join: (ws: DevSocket, { topic, ref, payload }: PhoenixEvent) => {
      let status: PhoenixEventStatus = 'ok';
      let response = 'ok';

      // Validation on attempt:* channels
      // TODO is this logic in the right place?
      if (topic.startsWith(ATTEMPT_PREFIX)) {
        const attemptId = extractAttemptId(topic);
        if (!state.pending[attemptId]) {
          status = 'error';
          response = 'invalid_attempt_id';
        } else if (!payload.token) {
          // TODO better token validation here
          status = 'error';
          response = 'invalid_token';
        }
      }
      ws.reply({
        topic,
        payload: { status, response },
        ref,
      });
    },
  };

  wsServer.on('connection', function (ws: DevSocket, _req: any) {
    logger?.info('new client connected');

    ws.reply = <R = any>({ ref, topic, payload }: PhoenixReply<R>) => {
      logger?.debug(
        `<< [${topic}] chan_reply_${ref} ` + JSON.stringify(payload)
      );
      ws.send(
        JSON.stringify({
          event: `chan_reply_${ref}`,
          ref,
          topic,
          payload,
        })
      );
    };

    ws.sendJSON = ({ event, ref, topic, payload }: PhoenixEvent) => {
      logger?.debug(`<< [${topic}] ${event} ` + JSON.stringify(payload));
      ws.send(
        JSON.stringify({
          event,
          ref,
          topic,
          payload,
        })
      );
    };

    ws.on('message', function (data: string) {
      const evt = JSON.parse(data) as PhoenixEvent;
      onMessage(evt);

      if (evt.topic) {
        // phx sends this info in each message
        const { topic, event, payload, ref } = evt;

        logger?.debug(
          `>> [${topic}] ${event} ${ref} :: ${JSON.stringify(payload)}`
        );

        if (events[event]) {
          // handle system/phoenix events
          events[event](ws, { topic, payload, ref });
        } else {
          // handle custom/user events
          if (channels[topic] && channels[topic].size) {
            channels[topic].forEach((fn) => {
              fn(ws, { event, topic, payload, ref });
            });
          } else {
            // This behaviour is just a convenience for unit tesdting
            ws.reply({
              ref,
              topic,
              payload: {
                status: 'error',
                response: `There are no listeners on channel ${topic}`,
              },
            });
          }
        }
      }
    });
  });

  const mockServer = wsServer as MockSocketServer;

  // debug API
  // TODO should this in fact be (topic, event, fn)?
  mockServer.listenToChannel = (topic: Topic, fn: EventHandler) => {
    if (!channels[topic]) {
      channels[topic] = new Set();
    }

    channels[topic].add(fn);

    return {
      unsubscribe: () => {
        channels[topic].delete(fn);
      },
    };
  };

  mockServer.waitForMessage = (topic: Topic, event: string) => {
    return new Promise<PhoenixEvent>((resolve) => {
      const listener = mockServer.listenToChannel(topic, (_ws, e) => {
        if (e.event === event) {
          listener.unsubscribe();
          resolve(e);
        }
      });
    });
  };

  mockServer.registerEvents = (topic: Topic, events) => {
    // listen to all events in the channel
    return mockServer.listenToChannel(topic, (ws, evt) => {
      const { event } = evt;
      // call the correct event handler for this event
      if (events[event]) {
        events[event](ws, evt);
      }
    });
  };

  return mockServer as MockSocketServer;
}

export default createServer;
