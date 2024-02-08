import { Logger } from '@openfn/logger';
import type { State, ErrorReport, StepId } from '@openfn/lexicon';

export type ErrorReporter = (
  state: State,
  stepId: StepId,
  error: NodeJS.ErrnoException & {
    severity?: string;
    handled?: boolean;
    type?: string;
    subtype?: string;
  }
) => ErrorReport;

// TODO this is really over complicated now
// Because we're taking closer control of errors
// we should be able to report more simply
const createErrorReporter = (logger: Logger): ErrorReporter => {
  return (state, stepId, error) => {
    const report: ErrorReport = {
      type: error.subtype || error.type || error.name,
      stepId,
      message: error.message,
      error: error,
    };

    if (error.code) {
      // An error coming from node will have a useful code and stack trace
      report.code = error.code as string;
      report.stack = error.stack as string;
    }

    if (error.severity === 'crash') {
      logger.error('CRITICAL ERROR! Aborting execution');
    }

    if (report.message) {
      logger.error(
        `${report.code || report.type || 'Error'}: ${report.message}`
      );
      logger.debug(error); // TODO the logger doesn't handle this very well
    } else {
      // This catches if a non-Error object is thrown, ie, `throw "e"`
      logger.error(error);
    }

    if (error.severity === 'fail') {
      logger.error(`Check state.errors.${stepId} for details.`);

      if (!state.errors) {
        state.errors = {};
      }

      state.errors[stepId] = report;
    }

    return report as ErrorReport;
  };
};

export default createErrorReporter;
