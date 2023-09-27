type EventHandler = (evt?: any) => void;

// Mock websocket implementations
export const mockChannel = (callbacks: Record<string, EventHandler> = {}) => {
  const c = {
    on: (event: string, fn: EventHandler) => {
      // TODO support multiple callbacks
      callbacks[event] = fn;
    },
    push: <P>(event: string, payload?: P) => {
      // if a callback was registered, trigger it
      // otherwise do nothing
      let result: any;
      if (callbacks[event]) {
        result = callbacks[event](payload);
      }

      return {
        receive: (_status: string, callback: EventHandler) => {
          setTimeout(() => callback(result), 1);
        },
      };
    },
    join: () => {
      if (callbacks.join) {
        // This is an attempt to mock a join fail
        // not sure it works that well...
        // @ts-ignore
        const { status, response } = callbacks.join();
        const receive = {
          receive: (requestedStatus: string, callback: EventHandler) => {
            if (requestedStatus === status) {
              setTimeout(() => callback(response), 1);
            }
            return receive;
          },
        };
        return receive;
      }
      const receive = {
        receive: (status: string, callback: EventHandler) => {
          if (status === 'ok') {
            setTimeout(() => callback(), 1);
          }
          // TODO error and timeout?
          return receive;
        },
      };
      return receive;
    },
  };
  return c;
};

type ChannelMap = Record<string, ReturnType<typeof mockChannel>>;

export const mockSocket = (_endpoint: string, channels: ChannelMap) => {
  const allChannels: ChannelMap = channels || {};
  return {
    onOpen: (callback: EventHandler) => {
      setTimeout(() => callback(), 1);
    },
    connect: () => {
      // noop
      // TODO maybe it'd be helpful to throw if the channel isn't connected?
    },
    channel: (topic: string) => {
      if (!allChannels[topic]) {
        allChannels[topic] = mockChannel();
      }
      return allChannels[topic];
    },
  };
};
