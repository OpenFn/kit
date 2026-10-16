import { ServerApp } from '../server';
import { INTERNAL_CLAIM_COMPLETE, INTERNAL_RUN_COMPLETE } from '../events';

import type { Logger } from '@openfn/logger';

export type DestroyOptions = {
  // Tear everything down now: don't wait for active runs or claims to complete
  immediate?: boolean;
};

const destroy = async (
  app: ServerApp,
  logger: Logger,
  options: DestroyOptions = {}
) => {
  const { immediate = false } = options;
  logger.info(
    immediate ? 'Closing server immediately...' : 'Closing server...'
  );

  // Close the server AND wait for runs to complete in parallel
  // The http server can take a moment to close and the two
  // close conditions are unrelated - so this just speeds things up a bit
  await Promise.all([
    new Promise<void>((resolve) => {
      app.destroyed = true;

      // Immediately stop asking for more work on all workloops
      for (const w of app.workloops) {
        w.stop('server closed');
      }

      // Shut down the HTTP server
      app.server.close(async () => {
        resolve();
      });

      if (immediate) {
        // Don't wait for open connections to drain
        app.server.closeAllConnections?.();
      }
    }),
    (async () => {
      if (!immediate) {
        // Let any active runs complete
        await waitForRunsAndClaims(app, logger);
      }

      app.queueChannel?.leave();
      // Kill the engine and socket
      await app.engine.destroy(immediate);
      app.socket?.disconnect();
    })(),
  ]);

  logger.success('Server closed');
};

const waitForRunsAndClaims = (app: ServerApp, logger: Logger) =>
  new Promise<void>((resolve) => {
    const log = () => {
      logger.debug(
        `Waiting for ${
          Object.keys(app.workflows).length
        } runs and ${app.pendingClaims()} claims to complete...`
      );
    };

    const checkAllClear = () => {
      if (Object.keys(app.workflows).length + app.pendingClaims() === 0) {
        logger.debug('All runs completed!');
        app.events.off(INTERNAL_RUN_COMPLETE, checkAllClear);
        app.events.off(INTERNAL_CLAIM_COMPLETE, checkAllClear);
        resolve();
      } else {
        log();
      }
    };

    if (Object.keys(app.workflows).length || app.pendingClaims()) {
      log();
      app.events.on(INTERNAL_RUN_COMPLETE, checkAllClear);
      app.events.on(INTERNAL_CLAIM_COMPLETE, checkAllClear);
    } else {
      logger.debug('No active runs detected, closing immediately');
      resolve();
    }
  });

export default destroy;
