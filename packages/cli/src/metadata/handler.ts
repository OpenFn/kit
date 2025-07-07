import { Logger } from '../util/logger';
import { MetadataOpts } from './command';
import loadState from '../util/load-state';
import * as cache from './cache';
import { getModuleEntryPoint } from '@openfn/runtime';
import { ExecutionPlan } from '@openfn/lexicon';
import { install, removePackage } from '../repo/handler';

// Add created date stamp to the metadata object
const decorateMetadata = (metadata: cache.AdaptorMetadata): void => {
  (metadata as cache.CachedMetadata).created = new Date().toISOString();
};

export const getAdaptorPath = async (
  adaptor: string,
  logger: Logger,
  repoDir?: string
): Promise<string | undefined> => {
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

export const shouldAutoinstall = (adaptor: string): boolean =>
  adaptor?.length > 0 && !adaptor.startsWith('/') && !adaptor.includes('=');

const metadataHandler = async (
  options: MetadataOpts,
  logger: Logger
): Promise<void> => {
  const { repoDir, adaptors, keepUnsupported } = options;
  const adaptor = adaptors[0];

  // Check cache first to avoid unnecessary downloads
  if (await cache.isAdaptorUnsupported(adaptor, repoDir)) {
    logger.info(
      `Adaptor ${adaptor} is known to not support metadata (cached) - skipping lookup`
    );
    logger.error('No metadata helper found');
    process.exit(1);
  }

  const state = await loadState({} as ExecutionPlan, options, logger);
  logger.success(`Generating metadata`);

  // Note that the config will be sanitised, so logging it may not be terrible helpful
  logger.info('config:', state);

  const config: cache.AdaptorConfiguration = state.configuration;
  if (!config || Object.keys(config).length === 0) {
    logger.error('ERROR: Invalid configuration passed');
    process.exit(1);
  }

  const finish = (): void => {
    logger.success('Done!');
    logger.print(cache.getCachePath(repoDir, id));
  };

  const id = cache.generateKey(config, adaptor);
  if (!options.force) {
    // generate a hash for the config and check state
    logger.debug('config hash: ', id);
    const cached = await cache.get<cache.CachedMetadata>(repoDir, id);
    if (cached) {
      logger.success('Returning metadata from cache');
      return finish();
    }
  }

  let wasAutoInstalled = false;
  try {
    if (shouldAutoinstall(adaptor)) {
      await install({ packages: [adaptor], repoDir }, logger);
      wasAutoInstalled = true;
    }

    const adaptorPath = await getAdaptorPath(adaptor, logger, options.repoDir);
    if (!adaptorPath) {
      throw new Error(`Could not resolve adaptor path for ${adaptor}`);
    }

    const mod = await import(adaptorPath);

    // Does it export a metadata function?
    if (mod.metadata && typeof mod.metadata === 'function') {
      logger.info('Metadata function found. Generating metadata...');
      const result: cache.AdaptorMetadata = await mod.metadata(config);
      decorateMetadata(result);
      await cache.set<cache.CachedMetadata>(
        repoDir,
        id,
        result as cache.CachedMetadata
      );
      finish();
    } else {
      logger.error('No metadata helper found');

      // If we auto-installed this adaptor and user didn't opt out, remove it and cache the result
      if (wasAutoInstalled && !keepUnsupported) {
        logger.info('Removing unsupported adaptor from disk...');
        await removePackage(adaptor, repoDir, logger);
        await cache.markAdaptorAsUnsupported(adaptor, repoDir);
        logger.info('Adaptor removed and marked as unsupported');
      } else if (wasAutoInstalled && keepUnsupported) {
        logger.info(
          'Keeping unsupported adaptor as requested by --keep-unsupported flag'
        );
        await cache.markAdaptorAsUnsupported(adaptor, repoDir);
      }

      process.exit(1); // TODO what's the correct error code?
    }
  } catch (e) {
    logger.error('Exception while generating metadata');
    logger.error(e);
    process.exit(1);
  }
};

export default metadataHandler;
