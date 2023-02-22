import { Opts } from '../options';
import { Logger } from './logger';

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
  }
};

export default validateAdaptors;
