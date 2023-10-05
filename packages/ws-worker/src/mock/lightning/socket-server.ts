/**
 * This module creates a mock pheonix socket server
 * It uses a standard ws server but wraps messages up in a
 * structure that pheonix sockets can understand
 * It also adds some dev and debug APIs, useful for unit testing
 */
import { WebSocketServer, WebSocket } from 'ws';
import querystring from 'query-string';
import { Serializer } from 'phoenix';

import { ATTEMPT_PREFIX, extractAttemptId } from './util';
import { ServerState } from './server';
import { stringify } from '../../util';

import type { Logger } from '@openfn/logger';

type Topic = string;

const decoder = Serializer.decode.bind(Serializer);
const decode = (data: any) => new Promise((done) => decoder(data, done));

const encoder = Serializer.encode.bind(Serializer);
const encode = (data: any) =>
  new Promise((done) => {
    if (data.payload?.response && data.payload.response instanceof Uint8Array) {
      // special encoding logic if the payload is a buffer
      // (we need to do this for dataclips)
      data.payload.response = Array.from(data.payload.response);
    }
    encoder(data, done);
  });

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
  join_ref: string;
};

export type PhoenixReply<R = any> = {
  topic: Topic;
  payload: {
    status: PhoenixEventStatus;
    response?: R;
  };
  ref: string;
  join_ref: string;
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
  const channels: Record<Topic, Set<EventHandler>> = {
    // create a stub listener for pheonix to prevent errors
    phoenix: new Set([() => null]),
  };

  const wsServer =
    server ||
    new WebSocketServer({
      port,
    });

  if (!server) {
    logger?.info('pheonix mock websocket server listening on', port);
  }

  const events = {
    // When joining a channel, we need to send a chan_reply_{ref} message back to the socket
    phx_join: (
      ws: DevSocket,
      { topic, ref, payload, join_ref }: PhoenixEvent
    ) => {
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
        join_ref,
      });
    },
  };

  wsServer.on('connection', function (ws: DevSocket, req: any) {
    logger?.info('new client connected');

    // Ensure that a JWT token is added to the
    const [_path, query] = req.url.split('?');
    const { token } = querystring.parse(query);

    // TODO for now, there's no validation on the token in this mock

    // If there is no token (or later, if invalid), close the connection immediately
    if (!token) {
      logger?.error('INVALID TOKEN');
      ws.close();

      // TODO I'd love to send back a 403 here, not sure how to do it
      // (and it's not important in the mock really)
      return;
    }

    ws.reply = async <R = any>({
      ref,
      topic,
      payload,
      join_ref,
    }: PhoenixReply<R>) => {
      // TODO only stringify payload if not a buffer
      logger?.debug(`<< [${topic}] chan_reply_${ref} ` + stringify(payload));
      const evt = await encode({
        event: `chan_reply_${ref}`,
        ref,
        join_ref,
        topic,
        payload,
      });
      ws.send(evt);
    };

    ws.sendJSON = async ({ event, ref, topic, payload }: PhoenixEvent) => {
      logger?.debug(`<< [${topic}] ${event} ` + stringify(payload));
      const evt = await encode({
        event,
        ref,
        topic,
        payload: stringify(payload), // TODO do we stringify this? All of it?
      });
      ws.send(evt);
    };

    ws.on('message', async function (data: string) {
      // decode  the data
      const evt = (await decode(data)) as PhoenixEvent;
      onMessage(evt);

      if (evt.topic) {
        // phx sends this info in each message
        const { topic, event, payload, ref, join_ref } = evt;

        logger?.debug(`>> [${topic}] ${event} ${ref} :: ${stringify(payload)}`);

        if (events[event]) {
          // handle system/phoenix events
          events[event](ws, { topic, payload, ref, join_ref });
        } else {
          // handle custom/user events
          if (channels[topic] && channels[topic].size) {
            channels[topic].forEach((fn) => {
              fn(ws, { event, topic, payload, ref, join_ref });
            });
          } else {
            // This behaviour is just a convenience for unit tesdting
            ws.reply({
              ref,
              join_ref,
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
