import { Opts } from '../options';
import { Logger } from './logger';

const validateAdaptors = async (
  options: Pick<
    Opts,
    | 'adaptors'
    | 'skipAdaptorValidation'
    | 'autoinstall'
    | 'repoDir'
    | 'workflowPath'
    | 'planPath'
    | 'expressionPath'
  > & {
    workflow?: Opts['workflow'];
  },
  logger: Logger
) => {
  if (options.skipAdaptorValidation) {
    return;
  }
  const hasDeclaredAdaptors = options.adaptors && options.adaptors.length > 0;

  if (!options.expressionPath && hasDeclaredAdaptors) {
    logger.error('ERROR: adaptor and workflow provided');
    logger.error(
      'This is probably not what you meant to do. A workflow should declare an adaptor for each job.'
    );
    throw new Error('adaptor and workflow provided');
  }

  // If running a .js file directly and no adaptor is specified, send a warning
  if (options.expressionPath && !hasDeclaredAdaptors) {
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
