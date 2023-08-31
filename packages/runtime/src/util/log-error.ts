import { Logger } from '@openfn/logger';
import { ErrorReport, JobNodeID, State } from '../types';

export type ErrorReporter = (
  state: State,
  jobId: JobNodeID,
  error: NodeJS.ErrnoException
) => ErrorReport;

const createErrorReporter = (logger: Logger): ErrorReporter => {
  return (state, jobId, error) => {
    const report: ErrorReport = {
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

    if (report.message) {
      logger.error(
        `${report.code || report.name || 'error'}: ${report.message}`
      );
      logger.debug(error); // TODO the logger doesn't handle this very well
    } else {
      // This catches if a non-Error object is thrown, ie, `throw "e"`
      logger.error('ERROR:', error);
    }

    logger.error(`Check state.errors.${jobId} for details.`);

    if (!state.errors) {
      state.errors = {};
    }

    state.errors[jobId] = report;

    return report as ErrorReport;
  };
};

export default createErrorReporter;
