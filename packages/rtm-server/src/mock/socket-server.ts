import { WebSocketServer } from 'ws';
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

function createServer() {
  const channels: Record<Topic, EventHandler[]> = {};

  const wsServer = new WebSocketServer({
    port: 8080,
  });

  // util to send a response to a particular topic
  const reply = () => {};

  const events = {
    // When joining a channel, we need to send a chan_reply_{ref} message back to the socket
    phx_join: (ws, { topic, ref }) => {
      ws.send(
        JSON.stringify({
          // here is the magic reply event
          // see channel.replyEventName
          event: `chan_reply_${ref}`,
          topic,
          payload: { status: 'ok', response: 'ok' },
          ref,
        })
      );
    },
  };

  wsServer.on('connection', function (ws: WS) {
    ws.on('message', function (data: string) {
      const evt = JSON.parse(data) as PhoenixEvent;
      if (evt.topic) {
        // phx sends this info in each message
        const { topic, event, payload, ref } = evt;

        if (events[event]) {
          // handle system/phoenix events
          events[event](ws, { topic, payload, ref });
        } else {
          // handle custom/user events
          if (channels[topic]) {
            channels[topic].forEach((fn) => fn(event, payload));
          }
        }
      }
    });
  });

  // debugAPI
  wsServer.listenToChannel = (topic: Topic, fn: EventHandler) => {
    if (!channels[topic]) {
      channels[topic] = [];
    }
    channels[topic].push(fn);
  };

  return wsServer;
}

export default createServer;
