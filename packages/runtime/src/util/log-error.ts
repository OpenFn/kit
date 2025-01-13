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

    logger.break();
    if (error.severity === 'crash') {
      logger.error('CRITICAL ERROR! Aborting execution');
    }

    if (error.pos) {
      if (error.stack) {
        // If there's a stack trace, log it (it'll include position, message and type)
        logger.error(error.stack);
        logger.break();
      } else {
        // If there's no stack trace, log the message and position
        logger.error(error.message, `(${error.pos.line}:${error.pos.column})`);
      }

      if (error.pos.src) {
        // Print the error line of code and a marker to the position
        const { src } = error.pos;
        const pointer = new Array(src.length).fill(' ');
        pointer[error.pos.column - 1] = '^';

        const prefix = `${error.pos.line}: `;

        logger.error('Error occurred at:', error.step ?? '');
        logger.error(`${prefix}${src}`);
        logger.error(`${prefix.replace(/./g, ' ')}${pointer.join('')}`);
        logger.error();
      }
    } else if (error.line && error.operationName) {
      // handle adaptor errors where we don't have a position that corresponds nicely to the sourcemapped code
      logger.error(
        `Error reported by "${error.operationName}()" operation line ${error.line}:`
      );

      // Log the stack or the message, depending on what we have
      if (error.stack) {
        logger.error(error.stack);
      } else {
        logger.error(error.message);
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

    if (error.details) {
      logger.error('Additional error details:');
      logger.print(error.details);
      logger.break();
    }

    if (error.severity === 'fail') {
      // Write a safely serialzied error object to state
      state.errors ??= {};
      state.errors[stepId] = serialize(error);

      logger.error(`Check state.errors.${stepId} for details`);
    }

    return report as ErrorReport;
  };
};

export default createErrorReporter;
