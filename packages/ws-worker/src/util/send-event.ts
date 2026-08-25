import * as Sentry from '@sentry/node';
import type { Context } from '../api/execute';
import { LightningSocketError, LightningTimeoutError } from '../errors';

// Force disabled for now because this can cause duplication on the Lightning end
// See https://github.com/OpenFn/kit/issues/1137
const allowRetryOntimeout = false;

// channel.socket is not part of our Channel type (or of @types/phoenix's),
// but it exists on the real phoenix Channel instance - reach for it
// defensively so a mock channel in tests, or a future phoenix version,
// cannot turn this into a reporting-path crash
const getSocketState = (channel: any): string | undefined => {
  try {
    return channel?.socket?.connectionState?.();
  } catch {
    return undefined;
  }
};

export const sendEvent = <T>(
  context: Pick<
    Context,
    'logger' | 'channel' | 'id' | 'options' | 'sentryScope'
  >,
  event: string,
  payload?: any,
  attempts?: number
) => {
  // Low defaults here are better for unit tests
  const { timeoutRetryCount = 1, timeoutRetryDelay = 1 } =
    context.options ?? {};

  const thisAttempt = attempts ?? 1;

  const { channel, logger, id: runId = '<unknown run>', sentryScope } = context;

  return new Promise<T>((resolve, reject) => {
    const report = (error: any) => {
      logger.error(`${runId} :: ${event} :: ERR: ${error.message || error}`);

      const context = {
        run_id: runId,
        event: event,
      };
      const extras: any = {
        // Distinguishes a genuine timeout/error on a healthy channel from
        // collateral damage while the channel is mid-rejoin after a drop
        channel_state: channel.state,
        socket_state: getSocketState(channel),
      };

      if (error.rejectMessage) {
        extras.rejection_reason = error.rejectMessage;
      }

      // report() is invoked from a phoenix receive callback, ie off the
      // socket's async chain, so the run's scope must be re-entered by hand
      Sentry.withIsolationScope(sentryScope, () => {
        Sentry.captureException(error, (scope) => {
          scope.setTag('run_id', runId);
          scope.setTag('lightning_event', event);
          // Every timeout (or every socket error) currently collapses into a
          // single sentry issue regardless of which event caused it. Splitting
          // the fingerprint by event name is what would have made this
          // pattern visible without needing to dig through raw events
          scope.setFingerprint([error.name, event]);
          scope.setContext('run', context);
          scope.setExtras(extras);
          return scope;
        });
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
        if (!allowRetryOntimeout || thisAttempt >= timeoutRetryCount) {
          report(new LightningTimeoutError(event));
        } else {
          // TODO at the moment, this retry logic all shares the same timeout,
          // where the timeout is controlled by the event processor
          // When we want to restore retries, we need to retry in the event
          // processor - not here
          // This actually feels cleaner and easier to test anyway
          logger.warn(
            `${runId} event ${event} timed out, will retry in ${timeoutRetryDelay}ms (attempt ${
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
