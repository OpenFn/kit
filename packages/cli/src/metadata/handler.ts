import { createNullLogger, Logger } from '../util/logger';
import { SafeOpts } from '../commands';
import loadState from '../execute/load-state';
import { updatePath } from '../util/use-adaptors-repo';
import cache from './cache';

const metadataHandler = async (options: SafeOpts, logger: Logger) => {
  const state = await loadState(options, logger);
  logger.info(state);

  const config = state.configuration;

  // validate the config object
  // must exist
  if (!config || Object.keys(config).length === 0) {
    logger.error('ERROR: Invalid configuration passed');
    process.exit(1);
  }

  const finish = () => {
    logger.success('Done!');
    logger.print(cache.getPath(repoDir, id));
  };

  const { adaptorsRepo, repoDir, adaptor } = options;

  // generate a hash for the config and check state
  const id = cache.generateKey(config);
  logger.debug('config hash: ', id);
  const cached = await cache.get(repoDir, id);
  if (cached) {
    logger.success('Metadata in cache!');
    return finish();
  }

  if (adaptorsRepo) {
    // TODO yeah this isn't a good solution
    const [_, path] = updatePath(adaptor as string, adaptorsRepo, logger).split(
      '='
    );
    const mod = await import(path);
    if (mod.metadata) {
      logger.info('metadata function found');
      logger.info('Generating...');
      const result = await mod.metadata(config);
      await cache.set(repoDir, id, result);
      finish();
    } else {
      logger.error('No metadata helper found');
      // This will happen a lot so I reckon we just want to write an error state
    }
  } else {
    // TODO for now use the adaptors repo, but later we want to be smarter about path resolution
    throw new Error('monorepo not set');
  }
  // // load the adaptor's execute function

  // // call it

  // // output into the repo
};

export default metadataHandler;
