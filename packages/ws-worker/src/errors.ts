export class LightningSocketError extends Error {
  name = 'LightningSocketError';
  event = '';
  rejectMessage = '';
  constructor(event: string, message: any) {
    super(
      `[${event}] ${
        typeof message === 'string' ? message : JSON.stringify(message)
      }`
    );
    this.event = event;
    this.rejectMessage = message;
  }
}

export class LightningTimeoutError extends Error {
  name = 'LightningTimeoutError';
  constructor(event: string) {
    super(`[${event}] timeout`);
  }
}
