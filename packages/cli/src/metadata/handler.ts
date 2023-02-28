import { Logger } from '../util/logger';
import { SafeOpts } from '../commands';
import loadState from '../execute/load-state';
import cache from './cache';
import { getModuleEntryPoint } from '@openfn/runtime';

// Add extra, uh, metadata to the, uh, metadata object
const decorateMetadata = (metadata: any) => {
  metadata.created = new Date().toISOString();
};

export const getAdaptorPath = async (
  adaptor: string,
  logger: Logger,
  repoDir?: string
) => {
  let adaptorPath;
  let adaptorSpecifier;

  if (adaptor.match('=')) {
    const parts = adaptor.split('=');
    adaptorSpecifier = parts[0];
    adaptorPath = parts[1];
  } else {
    if (adaptor.endsWith('.js')) {
      return adaptor;
    }
    adaptorSpecifier = adaptor;
  }

  if (!adaptorPath || !adaptorPath.endsWith('js')) {
    const entry = await getModuleEntryPoint(
      adaptorSpecifier,
      adaptorPath,
      repoDir,
      logger
    );
    adaptorPath = entry?.path;
  }

  logger.debug('loading adaptor from', adaptorPath);
  return adaptorPath;
};

const metadataHandler = async (options: SafeOpts, logger: Logger) => {
  const { repoDir, adaptors } = options;
  const adaptor = adaptors[0];

  const state = await loadState(options, logger);
  logger.success(`Generating metadata`);

  // Note that the config will be sanitised, so logging it may not be terrible helpful
  const config = state.configuration;
  logger.info('config:', config);

  if (!config || Object.keys(config).length === 0) {
    logger.error('ERROR: Invalid configuration passed');
    process.exit(1);
  }

  const finish = () => {
    logger.success('Done!');
    logger.print(cache.getPath(repoDir, id));
  };

  const id = cache.generateKey(config);
  if (!options.force) {
    // generate a hash for the config and check state
    logger.debug('config hash: ', id);
    const cached = await cache.get(repoDir, id);
    if (cached) {
      logger.success('Returning metadata from cache');
      return finish();
    }
  }

  try {
    // Import the adaptor
    const adaptorPath = await getAdaptorPath(adaptor, logger, options.repoDir);
    const mod = await import(adaptorPath!);

    // Does it export a metadata function?
    if (mod.metadata) {
      logger.info('Metadata function found. Generating metadata...');
      const result = await mod.metadata(config);
      decorateMetadata(result);
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