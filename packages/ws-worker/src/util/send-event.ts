import * as Sentry from '@sentry/node';
import type { Context } from '../api/execute';
import { LightningSocketError, LightningTimeoutError } from '../errors';

// // When a message receives a timeout, how many times should we retry?
// const TIMEOUT_RETRY_COUNT = process.env.WORKER_TIMEOUT_RETRY_COUNT
//   ? parseInt(process.env.WORKER_TIMEOUT_RETRY_COUNT)
//   : 10;

// // When a message receives a timeout, how long should we wait before retrying?
// const TIMEOUT_RETRY_DELAY =
//   process.env.WORKER_TIMEOUT_RETRY_DELAY ??
//   process.env.WORKER_MESSAGE_TIMEOUT_SECONDS ??
//   30 * 1000;

export const sendEvent = <T>(
  context: Pick<Context, 'logger' | 'channel' | 'id' | 'options'>,
  event: string,
  payload?: any,
  attempts?: number
) => {
  // Low defaults here are better for unit tests
  const { timeoutRetryCount = 1, timeoutRetryDelay = 1 } =
    context.options ?? {};

  const thisAttempt = attempts ?? 1;

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
        if (thisAttempt >= timeoutRetryCount) {
          report(new LightningTimeoutError(event));
        } else {
          logger.warn(
            `${runId} event ${event} timed out, will retry (attempt ${
              thisAttempt + 1
            } of ${timeoutRetryCount})`
          );

          setTimeout(() => {
            sendEvent<T>(context, event, payload, thisAttempt + 1)
              .then(resolve)
              .catch(reject);
          }, timeoutRetryDelay);
        }
      })
      .receive('ok', resolve);
  });
};

export default sendEvent;
