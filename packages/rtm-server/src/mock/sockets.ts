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

export const mockSocket = () => {
  const channels: Record<string, ReturnType<typeof mockChannel>> = {};
  return {
    onOpen: (callback: EventHandler) => {
      setTimeout(() => callback(), 1);
    },
    connect: () => {
      // noop
      // TODO maybe it'd be helpful to throw if the channel isn't connected?
    },
    channel: (topic: string) => {
      channels[topic] = mockChannel();
      return channels[topic];
    },
  };
};
