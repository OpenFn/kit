// This is the run command that will be executed inside the worker thread
// Most of the heavy lifting is actually handled by execute
import run from '@openfn/runtime';
import type { ExecutionPlan } from '@openfn/runtime';
import type { SanitizePolicies } from '@openfn/logger';
import type { NotifyEvents } from '@openfn/runtime';

import { register, publish } from './runtime';
import { execute, createLoggers } from './helpers';
import serializeError from '../../util/serialize-error';
import { JobErrorPayload } from '../../events';

type RunOptions = {
  adaptorPaths: Record<string, { path: string }>;
  whitelist?: RegExp[];
  sanitize: SanitizePolicies;
  statePropsToRemove?: string[];
  // TODO timeout
};

const eventMap = {
  'job-error': (evt: JobErrorPayload) => ({
    ...evt,
    error: serializeError(evt.error),
  }),
};

register({
  run: (plan: ExecutionPlan, runOptions: RunOptions) => {
    const { adaptorPaths, whitelist, sanitize, statePropsToRemove } =
      runOptions;
    const { logger, jobLogger } = createLoggers(plan.id!, sanitize);
    // TODO I would like to pull these options out of here

    const options = {
      // disable the run/step timeout
      timeout: 0,
      strict: false,
      logger,
      jobLogger,
      linker: {
        modules: adaptorPaths,
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

    return execute(plan.id!, () => run(plan, undefined, options));
  },
});
