type EventHandler = (evt?: any) => void;

// Mock websocket implementations
export const mockChannel = (
  callbacks: Record<string, EventHandler> = {}
): any => {
  const c = {
    on: (event: string, fn: EventHandler) => {
      // TODO support multiple callbacks
      callbacks[event] = fn;
    },
    push: <P>(event: string, payload?: P) => {
      const responses = {} as Record<'ok' | 'error' | 'timeout', EventHandler>;

      // if a callback was registered, trigger it
      // otherwise do nothing
      setTimeout(() => {
        if (callbacks[event]) {
          try {
            const result = callbacks[event](payload);
            responses.ok?.(result);
          } catch (e) {
            responses.error?.(e);
          }
        } else {
          responses.timeout?.('timeout');
        }
      }, 1);

      const receive = {
        receive: (
          status: 'ok' | 'error' | 'timeout' = 'ok',
          callback: EventHandler
        ) => {
          responses[status] = callback;
          return receive;
        },
      };
      return receive;
    },
    join: () => {
      if (callbacks.join) {
        // Here we try mock a join fail
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
    leave: () => {},
  };
  return c;
};

type ChannelMap = Record<string, ReturnType<typeof mockChannel>>;

export const mockSocket = (
  _endpoint?: string,
  channels?: ChannelMap,
  connect: () => Promise<void> = async () => {}
) => {
  const allChannels: ChannelMap = channels || {};

  const callbacks: Record<string, EventHandler> = {};
  return {
    onOpen: (callback: EventHandler) => {
      callbacks.onOpen = callback;
    },
    onError: (callback: EventHandler) => {
      callbacks.onError = callback;
    },
    onClose: (callback: EventHandler) => {
      // TODO this isn't actually hooked up right now
      callbacks.onClose = callback;
    },
    connect: () => {
      connect()
        .then(() => {
          setTimeout(() => callbacks?.onOpen?.(), 1);
        })
        .catch((e) => {
          setTimeout(() => callbacks?.onError?.(e), 1);
        });
    },
    channel: (topic: string) => {
      if (!allChannels[topic]) {
        allChannels[topic] = mockChannel();
      }
      return allChannels[topic];
    },
  };
};
