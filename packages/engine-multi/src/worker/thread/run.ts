// This is the run command that will be executed inside the worker thread
// Most of the heavy lifting is actually handled by execute
import run from '@openfn/runtime';
import type { ExecutionPlan } from '@openfn/runtime';
import type { SanitizePolicies } from '@openfn/logger';
import { register, publish } from './runtime';
import { execute, createLoggers } from './helpers';
import { NotifyEvents } from '@openfn/runtime';

type RunOptions = {
  adaptorPaths: Record<string, { path: string }>;
  whitelist?: RegExp[];
  sanitize: SanitizePolicies;
  statePropsToRemove?: string[];
  // TODO timeout
};

register({
  run: (plan: ExecutionPlan, runOptions: RunOptions) => {
    const { adaptorPaths, whitelist, sanitize, statePropsToRemove } =
      runOptions;
    const { logger, jobLogger } = createLoggers(plan.id!, sanitize);

    // TODO I would like to pull these options out of here
    const options = {
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
          // convert runtime notify events to internal engine events
          publish(`worker:${name}`, {
            workflowId: plan.id,
            ...payload,
          });
        },
      },
    };

    return execute(plan.id!, () => run(plan, undefined, options));
  },
});
