import { Logger } from '../util/logger';
import { SafeOpts } from '../commands';
import loadState from '../execute/load-state';
import cache from './cache';

const metadataHandler = async (options: SafeOpts, logger: Logger) => {
  logger.success('Generating metadata');
  const state = await loadState(options, logger);

  // Note that the config will be sanitised, so logging it may not be terrible helpful
  const config = state.configuration;
  logger.info('config:', config);

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

  // the adaptor path should now be totally set by the common cli stuff
  const { repoDir, adaptors } = options;
  const adaptor = adaptors[0]; // TODO adaptor argument is a bit dodgy, need to refactor opts
  console.log(' ** ', adaptor);
  // generate a hash for the config and check state
  const id = cache.generateKey(config);
  logger.debug('config hash: ', id);
  const cached = await cache.get(repoDir, id);
  if (cached) {
    logger.success('Returning metadata from cache');
    return finish();
  }

  try {
    // TODO add better support if a path is passed into the adaptor (maybe use repo.getModuleEntryPoint )
    let adaptorPath = adaptor.match('=') ? adaptor.split('=')[1] : adaptor;
    // Import the adaptor
    const mod = await import(adaptorPath);
    // Does it export a metadata function?
    if (mod.metadata) {
      logger.info('Metadata function found. Generating metadata...');
      const result = await mod.metadata(config);
      await cache.set(repoDir, id, result);
      finish();
    } else {
      logger.error('No metadata helper found');

      process.exit(1); // TODO what's the correct error code?
    }
  } catch (e) {
    logger.error('Exception while generating metadata');
    logger.error(e);
    process.exit(1);
  }
};

export default metadataHandler;
