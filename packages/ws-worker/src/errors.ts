export class LightningSocketError extends Error {
  name = 'LightningSocketError';
  event = '';
  rejectMessage = '';
  constructor(event: string, message: string) {
    super(`[${event}] ${message}`);
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
