import { Logger } from '@openfn/logger';
import { ErrorTypes, JobNodeID, State } from '../types';

export type ErrorReporter = (
  state: State,
  jobId: JobNodeID,
  type: ErrorTypes,
  error: Error
) => void;

const createErrorReporter = (logger: Logger): ErrorReporter => {
  // Util to save an error to state
  // Is this worth it?
  // Maybe later it can help with source mapping
  return (state, jobId, type, error) => {
    const report = {
      jobId,
      type,
      message: error.message,
      error: error, // Should include the code
    };

    const { stack } = error;
    if (stack?.match(/at vm:module/)) {
      // TODO if this is a vm:module error, try to pull something useful (like the line in question)
      // stack trace is useless but source line is useful
    } else {
      report.stack = stack;
    }

    logger.error(`Error in job "${jobId}"`);
    logger.error(`${error.code || type}: ${report.message}`);
    logger.debug(`Error written to state.errors.${jobId}`);
    logger.info(error); // tODO the logger doesn't handle this very well
    // console.log(error);
    // console.log(error.code);

    if (!state.errors) {
      state.errors = {};
    }

    // Can a job raise multiple errors? I think it'll abort
    // after the first
    state.errors[jobId] = report;
  };
};

export default createErrorReporter;
