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
  return (state, stepId, error: any) => {
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
      logger.print();
      logger.error('CRITICAL ERROR! Aborting execution');
    }

    if (error.pos) {
      logger.error(error.message, `(${error.pos.line}:${error.pos.column})`);
      if (error.pos.src) {
        // Print the error line of code and a marker to the position
        const { src } = error.pos;
        const pointer = new Array(src.length).fill(' ');
        pointer[error.pos.column - 1] = '^';

        const prefix = `${error.pos.line}: `;

        logger.error();
        logger.error(`${prefix}${src}`);
        logger.error(`${prefix.replace(/./g, ' ')}${pointer.join('')}`);
      }
    } else if (error.line && error.operationName) {
      // handle adaptor errors where we don't have a position that corresponds nicely to the sourcemapped code
      logger.error(
        `Error reported by "${error.operationName}()" operation line ${error.line}:`
      );
      logger.error(error.message);
    } else {
      logger.error(error.message);
    }

    // TODO we probably don't want to show all of this serialized error
    // details if it exists, maybe source and severity but probably not?
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
