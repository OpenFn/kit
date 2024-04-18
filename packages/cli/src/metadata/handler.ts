import { Logger } from '../util/logger';
import { MetadataOpts } from './command';
import loadState from '../util/load-state';
import cache from './cache';
import { getModuleEntryPoint } from '@openfn/runtime';
import { ExecutionPlan } from '@openfn/lexicon';
import { install } from '../repo/handler';
import getAutoinstall from './get-auto-install';

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
    // If we've been given a full path, just return it
    if (adaptor.endsWith('.js')) {
      return adaptor;
    }
    adaptorSpecifier = adaptor;
    // Check if we've been given a partial path (a path to a module)
    if (adaptor.startsWith('/')) {
      adaptorPath = adaptor;
    }
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

const metadataHandler = async (options: MetadataOpts, logger: Logger) => {
  const { repoDir, adaptors } = options;
  const adaptor = adaptors[0];

  const state = await loadState({} as ExecutionPlan, options, logger);
  logger.success(`Generating metadata`);

  // Note that the config will be sanitised, so logging it may not be terrible helpful
  logger.info('config:', state);

  const config = state.configuration;
  if (!config || Object.keys(config).length === 0) {
    logger.error('ERROR: Invalid configuration passed');
    process.exit(1);
  }

  const finish = () => {
    logger.success('Done!');
    logger.print(cache.getPath(repoDir, id));
  };

  const id = cache.generateKey(config, adaptor);
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
    //Install and import the adaptor
    const autoInstall = getAutoinstall(adaptor);
    if (autoInstall) {
      logger.info('Auto-installing language adaptors');
      await install({ packages: [adaptor], repoDir }, logger);
    }

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
