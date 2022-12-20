import { readFile } from 'node:fs/promises';
import { Opts } from '../commands';
import { Logger } from './logger';
import {
  getModulePath,
  getNameAndVersion,
  getLatestVersion,
} from '@openfn/runtime';

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
      const [adaptor, userPath] = a.split('=');
      let { name, version } = getNameAndVersion(adaptor);
      let didLookupLatest = false;

      let path: string | null = userPath;
      if (!userPath) {
        if (!version) {
          // TODO the difficulty of this is that we do the expensive version lookup here
          // But that information is discarded, only to be looked up again further downstream
          logger.info('No adaptor version info provided: looking up latest');
          version = await getLatestVersion(adaptor);
          logger.info(`Latest version of ${adaptor}: ${version}`);
          didLookupLatest = true;
        }

        path = await getModulePath(`${name}@${version}`, options.repoDir);
        if (!path) {
          if (options.autoinstall) {
            // if autoinstall is enabled, we can stop validation here and trust autoinstall to save it
            logger.info(`Will auto-install ${adaptor}@${version}`);
          } else {
            logger.error(`Adaptor ${adaptor} not installed in repo`);
            logger.error('Try adding -i to auto-install it');
            didError = true;
          }
          break;
        }
        // TODO if there IS a path, maybe we should write it back to the adaptors array to
        // save us looking it up again later
      }
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
        logger.success(
          `Adaptor ${name}@${pkg.version || version}${
            didLookupLatest ? '(latest)' : ''
          }: OK`
        );
      } catch (e) {
        // Expect read or parse file to throw here
        if (userPath) {
          logger.error(
            `Failed to load adaptor from path at ${path}/package.json`
          );
        } else {
          logger.error(
            `Failed to load adaptor from repo at ${path}/package.json`
          );
          logger.error(`Your repo may be corrupt`);
        }
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
