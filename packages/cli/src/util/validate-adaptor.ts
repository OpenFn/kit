import { readFile } from 'node:fs/promises';
import { Opts } from '../commands';
import { Logger } from './logger';
import { getModulePath, getNameAndVersion } from '@openfn/runtime';

const validateAdaptors = async (
  options: Pick<
    Opts,
    'adaptors' | 'skipAdaptorValidation' | 'autoinstall' | 'repoDir'
  >,
  logger: Logger
) => {
  if (options.skipAdaptorValidation) {
    return;
  }

  // If no adaptor is specified, pass a warning
  // (The runtime is happy to run without)
  // This can be overriden from options
  if (!options.adaptors || options.adaptors.length === 0) {
    logger.warn('WARNING: No adaptor provided!');
    logger.warn(
      'This job will probably fail. Pass an adaptor with the -a flag, eg:'
    );
    logger.break();
    logger.print('          openfn job.js -a common');
    logger.break();
  } else {
    // If there is an adaptor, check it exists or autoinstall is passed
    let didError;
    for (const a of options.adaptors) {
      const path = await getModulePath(a, options.repoDir);

      if (!options.autoinstall && !path) {
        logger.error(`Adaptor ${a} not installed in repo`);
        logger.error('Try adding -i to auto-install it');
        didError = true;
        break;
      }
      const { name, version } = getNameAndVersion(a);

      try {
        const pkgRaw = await readFile(`${path}/package.json`, 'utf8');
        const pkg = JSON.parse(pkgRaw);

        // Check for a matching package json too
        // This may not be entirely helpful
        if (version && pkg.version !== version) {
          logger.error('Adaptor version mismatch');
          logger.error(
            `Looked in repo for ${name}@${version}, but found ${pkg.version}`
          );
          didError = true;
          break;
        }

        // Log the path and version of what we found!
        logger.success(`Adaptor ${name}@${pkg.version || version}: OK`);
      } catch (e) {
        // Expect read or parse file to throw here
        logger.error(
          `Failed to load adaptor from repo at ${path}/package.json`
        );
        logger.error(`Your repo may be corrupt`);
        logger.error(e);
        didError = true;
      }
    }
    if (didError) {
      throw new Error('Failed to load adaptors');
    }
  }
};

export default validateAdaptors;
