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
    onClose: () => {},
    onError: () => {},
  };
  return c;
};

type ChannelMap = Record<string, ReturnType<typeof mockChannel>>;

export class MockSocket {
  private allChannels: ChannelMap;
  private callbacks: Record<string, EventHandler>;

  endpoint: string;
  constructor(
    endpoint: string = '',
    channels: ChannelMap = {},
    private _connect: () => Promise<void> = async () => {}
  ) {
    this.allChannels = channels;
    this.callbacks = {};
    this.endpoint = endpoint;
  }

  onOpen(callback: EventHandler): void {
    this.callbacks.onOpen = callback;
  }

  onError(callback: EventHandler): void {
    this.callbacks.onError = callback;
  }

  onClose(callback: EventHandler): void {
    // TODO this isn't actually hooked up right now
    this.callbacks.onClose = callback;
  }

  connect(): void {
    this._connect()
      .then(() => {
        setTimeout(() => this.callbacks?.onOpen?.(), 1);
      })
      .catch((e) => {
        setTimeout(() => this.callbacks?.onError?.(e), 1);
      });
  }

  channel(topic: string) {
    if (!this.allChannels[topic]) {
      this.allChannels[topic] = mockChannel();
    }
    return this.allChannels[topic];
  }
}
