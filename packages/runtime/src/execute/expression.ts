import { printDuration, Logger } from '@openfn/logger';
import type {
  Operation,
  SourceMapWithOperations,
  State,
} from '@openfn/lexicon';

import loadModule from '../modules/module-loader';
import { Options } from '../runtime';
import buildContext, { Context } from './context';
import defaultExecute from '../util/execute';
import clone from '../util/clone';
import {
  InputError,
  TimeoutError,
  JobError,
  assertAdaptorError,
  assertImportError,
  assertRuntimeCrash,
  assertRuntimeError,
  assertSecurityKill,
  AdaptorError,
} from '../errors';
import type { JobModule, ExecutionContext } from '../types';
import { ModuleInfoMap } from '../modules/linker';
import {
  clearNullState,
  isNullState,
  createNullState,
} from '../util/null-state';

export type ExecutionErrorWrapper = {
  state: any;
  error: any;
};

// TODO don't send the whole context because it's a bit confusing - just the options maybe?
export default (
  ctx: ExecutionContext,
  expression: string | Operation[],
  input: State,
  // allow custom linker options to be passed for this step
  // this lets us use multiple versions of the same adaptor in a workflow
  moduleOverrides?: ModuleInfoMap,
  sourceMap?: SourceMapWithOperations
) => {
  return new Promise(async (resolve, reject) => {
    let duration = Date.now();
    const { logger, plan, opts = {} } = ctx;
    try {
      const timeout = plan.options?.timeout ?? ctx.opts.defaultRunTimeoutMs;

      // Setup an execution context
      const context = buildContext(input, opts);

      const { operations, execute } = await prepareJob(
        expression,
        context,
        opts,
        moduleOverrides
      );
      // Create the main reducer function
      const reducer = (execute || defaultExecute)(
        ...operations.map((op, idx) =>
          wrapOperation(
            op,
            logger,
            `${idx + 1}`,
            idx,
            opts.immutableState,
            sourceMap
          )
        )
      );

      // Run the pipeline
      let tid;
      logger.debug(`Executing expression (${operations.length} operations)`);
      if (timeout) {
        logger.debug(`Timeout set to ${timeout}ms`);

        tid = setTimeout(() => {
          logger.error(`Error: Timeout expired (${timeout}ms)`);
          reject(new TimeoutError(timeout));
        }, timeout);
      }

      // Note that any errors will be trapped by the containing Job
      const result = await reducer(input);

      clearTimeout(tid);
      logger.debug('Expression complete!');

      duration = Date.now() - duration;

      resolve(result);
    } catch (e: any) {
      // whatever initial state looks like now, clean it and report it back
      duration = Date.now() - duration;
      let finalError;
      try {
        assertAdaptorError(e);
        assertImportError(e);
        assertRuntimeError(e);
        assertRuntimeCrash(e);
        assertSecurityKill(e);
        finalError = new JobError(e);
      } catch (e) {
        finalError = e;
      }

      reject({ state: input, error: finalError } as ExecutionErrorWrapper);
    }
  });
};

export const wrapOperation = (
  fn: Operation,
  logger: Logger,
  name: string,
  index: number,
  immutableState?: boolean,
  sourceMap?: SourceMapWithOperations
) => {
  return async (state: State) => {
    logger.debug(`Starting operation ${name}`);
    const start = new Date().getTime();
    if (isNullState(state)) {
      clearNullState(state);
      logger.warn(
        `WARNING: No state was passed into operation ${name}. Did the previous operation return state?`
      );
    }
    const newState = immutableState ? clone(state) : state;

    let result;
    try {
      result = await fn(newState);
    } catch (e: any) {
      if (e.stack) {
        const containsVMFrame = e.stack.match(/at vm:module\(0\)/);

        // Is this an error from inside adaptor code?
        const frames = e.stack.split('\n');
        frames.shift(); // remove the first line

        let firstFrame;

        // find the first frame from an adaptor or the VM
        // (this cuts out low level language errors like TypeError)
        do {
          const next = frames.shift();
          // If we hit a frame in runtime code, this is not an adaptor error
          if (/@openfn\/runtime/.test(next)) {
            break;
          }
          if (
            // detect an adaptor prod, adaptor monorepo, or vm frame
            /(@openfn\/language-)|(packages\/.+\/dist)|(vm:module)|(node_modules)/.test(
              next
            )
          ) {
            firstFrame = next;
            break;
          }
        } while (frames.length);

        // If that error did NOT come from the VM stack, it's an adaptor error
        // This is a little sketchy for nested operations
        if (firstFrame && !firstFrame.match(/at vm:module\(0\)/)) {
          let operation;

          // If there is no vm stuff in the stack, attribute
          // the error position to the correct operation in the sourcemap
          if (!containsVMFrame && sourceMap?.operations) {
            operation = sourceMap?.operations[index];
          }

          const error = new AdaptorError(e, operation);
          throw error;
        }
      }

      // Just re-throw the error to be handled elsewhere
      throw e;
    }

    if (!result) {
      logger.debug(`Warning: operation ${name} did not return state`);
      result = createNullState() as unknown as State;
    }

    // TODO should we warn if an operation does not return state?
    // the trick is saying WHICH operation without source mapping
    const duration = printDuration(new Date().getTime() - start);
    logger.debug(`Operation ${name} complete in ${duration}`);
    return result;
  };
};

export const mergeLinkerOptions = (
  options: ModuleInfoMap = {},
  overrides: ModuleInfoMap = {}
) => {
  const opts: ModuleInfoMap = {};
  for (const specifier in options) {
    opts[specifier] = options[specifier];
  }
  for (const specifier in overrides) {
    opts[specifier] = Object.assign({}, opts[specifier], overrides[specifier]);
  }
  return opts;
};

const prepareJob = async (
  expression: string | Operation[],
  context: Context,
  opts: Options = {},
  moduleOverrides: ModuleInfoMap = {}
): Promise<JobModule> => {
  if (typeof expression === 'string') {
    const exports = await loadModule(expression, {
      ...opts.linker,
      // allow module paths and versions to be overriden from the defaults
      modules: mergeLinkerOptions(opts.linker?.modules, moduleOverrides),
      context,
      log: opts.logger,
    });
    const operations = exports.default;
    return {
      operations,
      ...exports,
    } as JobModule;
  } else {
    if (opts.forceSandbox) {
      throw new InputError('Invalid arguments: jobs must be strings');
    }
    return { operations: expression as Operation[] };
  }
};
