// This is the run command that will be executed inside the worker thread
// Most of the heavy lifting is actually handled by execute
import run from '@openfn/runtime';
import type { NotifyEvents } from '@openfn/runtime';
import type { ExecutionPlan, State } from '@openfn/lexicon';
import type { SanitizePolicies } from '@openfn/logger';

import { register, publish } from './runtime';
import { execute, createLoggers } from './helpers';
import serializeError from '../../util/serialize-error';
import { JobErrorPayload } from '../../events';

export type RunOptions = {
  repoDir: string;
  whitelist?: RegExp[];
  sanitize: SanitizePolicies;
  statePropsToRemove?: string[];
};

const eventMap = {
  'job-error': (evt: JobErrorPayload) => ({
    ...evt,
    error: serializeError(evt.error),
  }),
};

register({
  run: (plan: ExecutionPlan, input: State, runOptions: RunOptions) => {
    const { repoDir, whitelist, sanitize, statePropsToRemove } = runOptions;
    const { logger, jobLogger, adaptorLogger } = createLoggers(
      plan.id!,
      sanitize,
      publish
    );

    // Save the debug function so that we can use it
    const debug = console.debug;

    // override console: any console.log statements will now get treated as adaptor logs
    console = adaptorLogger;

    // Leave console.debug for local debugging
    // This goes to stdout but not the adpator logger
    console.debug = debug;

    // TODO I would like to pull these options out of here
    const options = {
      // disable the run/step timeout
      timeout: 0,
      strict: false,
      logger,
      jobLogger,
      linker: {
        repo: repoDir,
        whitelist,
        cacheKey: plan.id,
      },
      statePropsToRemove,
      callbacks: {
        // TODO: this won't actually work across the worker boundary
        // For now I am preloading credentials
        // resolveCredential: async (id: string) => {},
        notify: (name: NotifyEvents, payload: any) => {
          // @ts-ignore
          const mappedPayload = eventMap[name]?.(payload) ?? payload;
          publish(`worker:${name}`, {
            workflowId: plan.id,
            ...mappedPayload,
          });
        },
      },
    };

    return execute(plan.id!, () => run(plan, input, options));
  },
});
