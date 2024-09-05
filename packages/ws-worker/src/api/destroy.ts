import { ServerApp } from '../server';
import { INTERNAL_RUN_COMPLETE } from '../events';

import type { Logger } from '@openfn/logger';

const destroy = async (app: ServerApp, logger: Logger) => {
  logger.info('Closing server...');

  // Close the server AND wait for runs to complete in parallel
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
      // Let any active runs complete
      await waitForRuns(app, logger);

      // Kill the engine and socket
      await app.engine.destroy();
      app.socket?.disconnect();

      resolve();
    }),
  ]);

  logger.success('Server closed');
};

const waitForRuns = (app: ServerApp, logger: Logger) =>
  new Promise<void>((resolve) => {
    const log = () => {
      logger.debug(
        `Waiting for ${Object.keys(app.workflows).length} runs to complete...`
      );
    };

    const onRunComplete = () => {
      if (Object.keys(app.workflows).length === 0) {
        logger.debug('All runs completed!');
        app.events.off(INTERNAL_RUN_COMPLETE, onRunComplete);
        resolve();
      } else {
        log();
      }
    };

    if (Object.keys(app.workflows).length) {
      log();
      app.events.on(INTERNAL_RUN_COMPLETE, onRunComplete);
    } else {
      logger.debug('No active runs detected, closing immediately');
      resolve();
    }
  });

export default destroy;
