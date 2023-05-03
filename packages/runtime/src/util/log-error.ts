import { Logger } from '@openfn/logger';
import { JobNodeID, State } from '../types';

export type ErrorReporter = (
  state: State,
  jobId: JobNodeID,
  error: Error
) => void;

const createErrorReporter = (logger: Logger): ErrorReporter => {
  return (state, jobId, error) => {
    const report = {
      name: error.name,
      jobId,
      message: error.message,
      error: error,
    };

    if (error.code) {
      // An error coming from node will have a useful code and stack trace
      report.code = error.code as string;
      report.stack = error.stack as string;
    }

    logger.debug(`Error thrown by job ${jobId}`);
    logger.error(`${error.code || error.name || type}: ${report.message}`);
    logger.debug(`Error written to state.errors.${jobId}`);
    logger.debug(error); // TODO the logger doesn't handle this very well

    if (!state.errors) {
      state.errors = {};
    }

    state.errors[jobId] = report;

    return report;
  };
};

export default createErrorReporter;
