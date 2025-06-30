function serializeMessage(message: any): string {
  if (typeof message === 'string') {
    return message;
  }

  if (message instanceof Error) {
    return message.toString();
  }

  if (message && typeof message === 'object') {
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  return String(message);
}

export class LightningSocketError extends Error {
  name = 'LightningSocketError';
  event = '';
  rejectMessage = '';
  constructor(event: string, message: any) {
    super(`[${event}] ${serializeMessage(message)}`);
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
