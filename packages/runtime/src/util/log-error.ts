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

// TODO this should be simpler now because the error is guaranteed
// to be a serializable object
// We do need to work out how to graft the step on it though

// TODO this really over complicated
// I think right now we log it AND emit it
// and write the  error to final state
// isn't there a cleaner solution?

// TODO this is really over complicated now
// Because we're taking closer control of errors
// we should be able to report more simply
const createErrorReporter = (logger: Logger): ErrorReporter => {
  return (state, stepId, error) => {
    if (error.message) {
      logger.error(`${error.type}:`, error.message);
    } else {
      logger.error(error.type);
    }
    if (error.details) {
      // this doesn't serialize very prettily
      // like I don't want to literally log a JSON object
      // how can I log with pretty printing in a way that the worker doesn't mind?
      // part of the problem is that the logger will json.stringify output
      // which is acutally quite ugly
      //logger.print(error.details);
      logger.error('Error details', error.details);
    }

    if (error.severity === 'crash') {
      logger.error('CRITICAL ERROR! Aborting execution');
    }

    // const report: ErrorReport = {
    //   type: error.subtype || error.type || error.name,
    //   stepId,
    //   message: error.message,
    //   error: error,
    // };

    // if (error.code) {
    //   // An error coming from node will have a useful code and stack trace
    //   report.code = error.code as string;
    //   report.stack = error.stack as string;
    // }

    // TODO severity is now in details
    if (
      error.details?.severity === 'fail' ||
      error.details?.severity === 'crash'
    ) {
      logger.error(`Check state.errors.${stepId} for details.`);

      if (!state.errors) {
        state.errors = {};
      }

      state.errors[stepId] = error;
    }

    // return report as ErrorReport;
    return error; // no point in the reurn? maybe for testing?
  };
};

export default createErrorReporter;
