import * as Sentry from '@sentry/node';
import type { Context } from '../api/execute';
import { LightningSocketError, LightningTimeoutError } from '../errors';

export const sendEvent = <T>(
  context: Pick<Context, 'logger' | 'channel' | 'id'>,
  event: string,
  payload?: any
) => {
  const { channel, logger, id: runId = '<unknown run>' } = context;

  return new Promise<T>((resolve, reject) => {
    const report = (error: any) => {
      logger.error(`${runId} :: ${event} :: ERR: ${error.message || error}`);

      const context = {
        run_id: runId,
        event: event,
      };
      const extras: any = {};

      if (error.rejectMessage) {
        extras.rejection_reason = error.rejectMessage;
      }

      Sentry.captureException(error, (scope) => {
        scope.setContext('run', context);
        scope.setExtras(extras);
        return scope;
      });

      // Mark that we've reported this to downstream handlers
      error.reportedToSentry = true;

      reject(error);
    };

    channel
      .push<T>(event, payload)
      .receive('error', (message) => {
        report(new LightningSocketError(event, message));
      })
      .receive('timeout', () => {
        report(new LightningTimeoutError(event));
      })
      .receive('ok', resolve);
  });
};

export default sendEvent;
