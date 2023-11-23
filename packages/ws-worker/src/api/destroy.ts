import { ServerApp } from '../server';
import { INTERNAL_ATTEMPT_COMPLETE } from '../events';

import type { Logger } from '@openfn/logger';

const destroy = async (app: ServerApp, logger: Logger) => {
  logger.info('Closing server...');

  // Close the server AND wait for attempts to complete in parallel
  // The http server can take a moment to close and the two
  // close conditions are unrelated - so this just speeds things up a bit
  await Promise.all([
    new Promise<void>((resolve) => {
      app.destroyed = true;

      // Immediately stop asking for more work
      app.killWorkloop?.();
      app.queueChannel?.leave();

      // Shut down the HTTP server
      app.server.close(async () => {
        resolve();
      });
    }),
    new Promise<void>(async (resolve) => {
      // Let any active attempts complete
      await waitForAttempts(app, logger);

      // Kill the engine and socket
      await app.engine.destroy();
      app.socket?.disconnect();

      resolve();
    }),
  ]);

  logger.success('Server closed');
};

const waitForAttempts = (app: ServerApp, logger: Logger) =>
  new Promise<void>((resolve) => {
    const log = () => {
      logger.debug(
        `Waiting for ${
          Object.keys(app.workflows).length
        } attempts to complete...`
      );
    };

    const onAttemptComplete = () => {
      if (Object.keys(app.workflows).length === 0) {
        logger.debug('All attempts completed!');
        app.events.off(INTERNAL_ATTEMPT_COMPLETE, onAttemptComplete);
        resolve();
      } else {
        log();
      }
    };

    if (Object.keys(app.workflows).length) {
      log();
      app.events.on(INTERNAL_ATTEMPT_COMPLETE, onAttemptComplete);
    } else {
      resolve();
    }
  });

export default destroy;
