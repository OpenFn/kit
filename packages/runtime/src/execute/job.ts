// TODO hmm. I have a horrible feeling that the callbacks should go here
// at least the resolvesrs
import executeExpression from './expression';

import clone from '../util/clone';
import assembleState from '../util/assemble-state';
import type {
  CompiledJobNode,
  ExecutionContext,
  JobNodeID,
  State,
} from '../types';
import { EdgeConditionError } from '../errors';
import {
  NOTIFY_INIT_COMPLETE,
  NOTIFY_INIT_START,
  NOTIFY_JOB_ERROR,
} from '../events';

const loadCredentials = async (
  job: CompiledJobNode,
  resolver: (id: string) => Promise<any>
) => {
  if (typeof job.configuration === 'string') {
    // TODO let's log and notify something useful if we're lazy loading
    // TODO throw a controlled error if there's no reoslver
    return resolver(job.configuration);
  }
  return job.configuration;
};

const loadState = async (
  job: CompiledJobNode,
  resolver: (id: string) => Promise<any>
) => {
  if (typeof job.state === 'string') {
    // TODO let's log and notify something useful if we're lazy loading
    // TODO throw a controlled error if there's no resolver
    return resolver(job.state);
  }
  return job.state;
};

// The job handler is responsible for preparing the job
// and working out where to go next
// it'll resolve credentials and state and notify how long init took
const executeJob = async (
  ctx: ExecutionContext,
  job: CompiledJobNode,
  initialState: State = {}
): Promise<{ next: JobNodeID[]; state: any }> => {
  const next: string[] = [];

  const { opts, notify, logger, report } = ctx;

  const duration = Date.now();

  notify(NOTIFY_INIT_START);

  // lazy load config and state
  const configuration = await loadCredentials(
    job,
    opts.callbacks?.resolveCredential! // cheat - we need to handle the error case here
  );

  const globals = await loadState(
    job,
    opts.callbacks?.resolveState! // and here
  );

  const state = assembleState(
    clone(initialState),
    configuration,
    globals,
    opts.strict
  );

  notify(NOTIFY_INIT_COMPLETE, { duration: Date.now() - duration });

  // We should by this point have validated the plan, so the job MUST exist

  logger.timer('job');
  logger.always('Starting job', job.id);

  // The expression SHOULD return state, but COULD return anything
  let result: any = state;
  if (job.expression) {
    const startTime = Date.now();
    try {
      const duration = logger.timer('job');
      result = await executeExpression(ctx, job.expression, state, job.id);
      logger.success(`Completed job ${job.id} in ${duration}`);
    } catch (e: any) {
      const duration = logger.timer('job');
      logger.error(`Failed job ${job.id} after ${duration}`);
      report(state, job.id, e);

      notify(NOTIFY_JOB_ERROR, {
        duration: Date.now() - startTime,
        error: e,
        state,
        jobId: job.id,
      });

      // Stop executing if the error is sufficiently severe
      if (e.severity === 'crash' || e.severity === 'kill') {
        throw e;
      }
    }
  }

  if (job.next) {
    for (const nextJobId in job.next) {
      const edge = job.next[nextJobId];
      if (!edge) {
        continue;
      }
      if (typeof edge === 'object') {
        if (edge.disabled || !edge.condition) {
          continue;
        }
        if (typeof edge.condition === 'function') {
          try {
            if (!edge.condition(result)) {
              continue;
            }
          } catch (e: any) {
            throw new EdgeConditionError(e.message);
          }
        }
      }
      next.push(nextJobId);
      // TODO errors
    }
  }
  return { next, state: result };
};

export default executeJob;
