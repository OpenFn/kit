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

const serialize = (error: any) => {
  if (error instanceof Error) {
    const result: any = {};
    for (const key in error) {
      // @ts-ignore
      result[key] = serialize(error[key]);
    }
    return result;
  }
  return error;
};

// TODO this is really over complicated now
// Because we're taking closer control of errors
// we should be able to report more simply
const createErrorReporter = (logger: Logger): ErrorReporter => {
  return (state, stepId, error) => {
    // TODO I don't think the report is useful anymore
    // we'll strip it all out soon
    // see https://github.com/OpenFn/kit/issues/726
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

    const serializedError = serialize(error);
    logger.error(serializedError);

    if (error.severity === 'fail') {
      logger.error(`Check state.errors.${stepId} for details.`);

      if (!state.errors) {
        state.errors = {};
      }

      state.errors[stepId] = serializedError;
    }

    return report as ErrorReport;
  };
};

export default createErrorReporter;
