import { WebSocketServer } from 'ws';
import { ATTEMPT_PREFIX, extractAttemptId } from './util';

// mock pheonix websocket server

// - route messages to rooms
// - respond ok to connections
type Topic = string;

type WS = any;

type PhoenixEvent = {
  topic: Topic;
  event: string;
  payload?: any;
  ref?: string;
};

type EventHandler = (event: string, payload: any) => void;

function createServer({ port = 8080, server, state, onMessage = () => {} } = {}) {
  // console.log('ws listening on', port);
  const channels: Record<Topic, Set<EventHandler>> = {};

  const wsServer =
    server ||
    new WebSocketServer({
      port,
    });

  const events = {
    // testing (TODO shouldn't this be in a specific channel?)
    ping: (ws, { topic, ref }) => {
      ws.send(
        JSON.stringify({
          topic,
          ref,
          event: 'pong',
          payload: {},
        })
      );
    },
    // When joining a channel, we need to send a chan_reply_{ref} message back to the socket
    phx_join: (ws, { event, topic, ref }) => {
      let status = 'ok';
      let response = 'ok';

      // TODO is this logic in the right place?
      if (topic.startsWith(ATTEMPT_PREFIX)) {
        const attemptId = extractAttemptId(topic);
        if (!state.pending[attemptId]) {
          status = 'error';
          response = 'invalid_attempt';
        }
      }
      ws.send(
        JSON.stringify({
          // here is the magic reply event
          // see channel.replyEventName
          event: `chan_reply_${ref}`,
          topic,
          payload: { status, response },
          ref,
        })
      );
    },
  };

  wsServer.on('connection', function (ws: WS, req) {
    ws.on('message', function (data: string) {
      const evt = JSON.parse(data) as PhoenixEvent;
      onMessage(evt);

      if (evt.topic) {
        // phx sends this info in each message
        const { topic, event, payload, ref } = evt;

        if (events[event]) {
          // handle system/phoenix events
          events[event](ws, { topic, payload, ref });
        } else {
          // handle custom/user events
          if (channels[topic]) {
            channels[topic].forEach((fn) => {
              fn(ws, { event, topic, payload, ref });
            });
          }
        }
      }
    });
  });

  // debugAPI
  wsServer.listenToChannel = (topic: Topic, fn: EventHandler) => {
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

  wsServer.waitForMessage = (topic: Topic, event: string) => {
    return new Promise((resolve) => {
      const listener = wsServer.listenToChannel(
        topic,
        (ws, e) => {
          if (e.event === event) {
            listener.unsubscribe();
            resolve(event);
          }
        }
      );
    });
  };

  // TODO how do we unsubscribe?
  wsServer.registerEvents = (topic: Topic, events) => {
    for (const evt in events) {
      wsServer.listenToChannel(topic, events[evt]);
    }
  };

  return wsServer;
}

export default createServer;
