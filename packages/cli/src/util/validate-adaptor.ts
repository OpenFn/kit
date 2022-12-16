import { readFile } from 'node:fs/promises';
import { Opts } from '../commands';
import { Logger } from './logger';
import { getModulePath, getNameAndVersion } from '@openfn/runtime';

const validateAdaptors = async (
  options: Pick<Opts, 'adaptors' | 'skipAdaptorValidation' | 'autoinstall'>,
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
  }
  // If there is an adaptor, check it exists or autoinstall is passed
  else if (!options.autoinstall) {
    let didError;
    for (const a of options.adaptors) {
      const path = await getModulePath(a);
      if (!path) {
        logger.error(`Adaptor ${a} not installed in repo`);
        logger.error('Try adding -i to auto-install it');
        didError = true;
      }
      // // Check for a matching package json too
      // const { name, version } = getNameAndVersion(a);

      // const pkgRaw = await readFile(`${path}/package.json`, 'utf8');
      // const pkg = JSON.parse(pkgRaw);

      // Log the path and version of what we found!
    }
    if (didError) {
      throw new Error('Failed to load adaptors');
    }
  }
};

export default validateAdaptors;
