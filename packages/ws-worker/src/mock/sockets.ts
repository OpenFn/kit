type EventHandler = (evt?: any) => void;

// Mock websocket implementations
export const mockChannel = (
  callbacks: Record<string, EventHandler> = {}
): any => {
  const closeCallbacks: EventHandler[] = [];
  const errorCallbacks: EventHandler[] = [];
  const c = {
    on: (event: string, fn: EventHandler) => {
      // TODO support multiple callbacks
      callbacks[event] = fn;
    },
    push: <P>(event: string, payload?: P) => {
      const responses = {} as Record<'ok' | 'error' | 'timeout', EventHandler>;

      // if a callback was registered, trigger it
      // otherwise do nothing
      setTimeout(async () => {
        if (callbacks[event]) {
          try {
            const result = await callbacks[event](payload);
            // Special timeout handler
            if (result === null) {
              responses.timeout?.('timeout');
            } else {
              responses.ok?.(result);
            }
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
    // Real phoenix channels support multiple onClose/onError bindings (each
    // call pushes onto an array), which is now relied on in production -
    // run.ts and execute.ts both bind onError on the same channel. So this
    // collects every registered callback rather than keeping only the last
    onClose: (fn: EventHandler) => {
      closeCallbacks.push(fn);
    },
    onError: (fn: EventHandler) => {
      errorCallbacks.push(fn);
    },
    // test helpers: fire every registered callback, as the real socket would
    _triggerClose: (...args: any[]) =>
      closeCallbacks.forEach((fn) => fn(...args)),
    _triggerError: (...args: any[]) =>
      errorCallbacks.forEach((fn) => fn(...args)),
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

  onMessage(callback: EventHandler): void {
    this.callbacks.onMessage = callback;
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

  channel(topic: string, params?: any) {
    if (!this.allChannels[topic]) {
      this.allChannels[topic] = mockChannel();
    }
    // @ts-ignore
    this.allChannels[topic]._joinParams = params;
    return this.allChannels[topic];
  }
}
