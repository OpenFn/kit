// Dedicated worker for running jobs
import run from '@openfn/runtime';
import type { ExecutionPlan } from '@openfn/runtime';
import type { SanitizePolicies } from '@openfn/logger';
import helper, { register, createLoggers, publish } from './worker-helper';
import { NotifyEvents } from '@openfn/runtime';

type RunOptions = {
  adaptorPaths: Record<string, { path: string }>;
  whitelist?: RegExp[];
  sanitize: SanitizePolicies;
  // TODO timeout
};

register({
  run: (plan: ExecutionPlan, runOptions: RunOptions) => {
    const { adaptorPaths, whitelist, sanitize } = runOptions;
    const { logger, jobLogger } = createLoggers(plan.id!, sanitize);
    const options = {
      strict: false,
      logger,
      jobLogger,
      linker: {
        modules: adaptorPaths,
        whitelist,
        cacheKey: plan.id,
      },
      callbacks: {
        // TODO: this won't actually work across the worker boundary
        // For now I am preloading credentials
        // resolveCredential: async (id: string) => {},
        notify: (name: NotifyEvents, payload: any) => {
          // convert runtime notify events to internal engine events
          publish(plan.id!, `worker:${name}`, payload);
        },
      },
    };

    return helper(plan.id!, () => run(plan, undefined, options));
  },
});
