// TODO hmm. I have a horrible feeling that the callbacks should go here
// at least the resolvesrs
import type { Job, State, StepId } from '@openfn/lexicon';
import type { Logger } from '@openfn/logger';

import executeExpression, { ExecutionErrorWrapper } from './expression';
import clone from '../util/clone';
import assembleState from '../util/assemble-state';
import type { CompiledStep, ExecutionContext } from '../types';
import { EdgeConditionError } from '../errors';
import {
  NOTIFY_INIT_COMPLETE,
  NOTIFY_INIT_START,
  NOTIFY_JOB_COMPLETE,
  NOTIFY_JOB_ERROR,
  NOTIFY_JOB_START,
} from '../events';

const loadCredentials = async (
  job: Job,
  resolver: (id: string) => Promise<any>
) => {
  if (typeof job.configuration === 'string') {
    // TODO let's log and notify something useful if we're lazy loading
    // TODO throw a controlled error if there's no resolver
    return resolver(job.configuration);
  }
  return job.configuration;
};

const loadState = async (job: Job, resolver: (id: string) => Promise<any>) => {
  if (typeof job.state === 'string') {
    // TODO let's log and notify something useful if we're lazy loading
    // TODO throw a controlled error if there's no resolver
    return resolver(job.state);
  }
  return job.state;
};

const calculateNext = (job: CompiledStep, result: any, logger: Logger) => {
  const next: string[] = [];
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
              logger.debug(
                `Edge ${edge.condition.toString()} returned false; ${nextJobId} will NOT be executed`
              );
              continue;
            }
          } catch (e: any) {
            throw new EdgeConditionError(e.message);
          }
          logger.debug(
            `Edge ${edge.condition.toString()} returned true; ${nextJobId} will be executed next`
          );
        }
      }
      next.push(nextJobId);
      // TODO errors
    }
  }
  return next;
};

// The job handler is responsible for preparing the job
// and working out where to go next
// it'll resolve credentials and state and notify how long init took
const executeStep = async (
  ctx: ExecutionContext,
  step: CompiledStep,
  input: State = {}
): Promise<{ next: StepId[]; state: any }> => {
  const { opts, notify, logger, report } = ctx;

  const duration = Date.now();

  const stepId = step.id;

  // The expression SHOULD return state, but COULD return anything
  let result: any = input;
  let next: string[] = [];
  let didError = false;

  if (step.expression) {
    const job = step as Job;
    const jobId = job.id!;
    const jobName = job.name || job.id;

    // The notify events only apply to jobs - not steps - so names don't need to be changed here
    notify(NOTIFY_INIT_START, { jobId });

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
      clone(input),
      configuration,
      globals,
      opts.strict
    );

    notify(NOTIFY_INIT_COMPLETE, {
      jobId,
      duration: Date.now() - duration,
    });

    // We should by this point have validated the plan, so the step MUST exist

    const timerId = `step-${jobId}`;
    logger.timer(timerId);
    logger.always(`Starting step ${jobName}`);

    const startTime = Date.now();
    try {
      // TODO include the upstream job?
      notify(NOTIFY_JOB_START, { jobId });
      result = await executeExpression(ctx, job.expression, state);
    } catch (e: any) {
      didError = true;
      if (e.hasOwnProperty('error') && e.hasOwnProperty('state')) {
        const { error, state } = e as ExecutionErrorWrapper;

        // Whatever the final state was, save that as the intial state to the next thing
        result = state;

        const duration = logger.timer(timerId);
        logger.error(`Failed step ${jobName} after ${duration}`);
        report(state, jobId, error);

        next = calculateNext(step, result, logger);

        notify(NOTIFY_JOB_ERROR, {
          duration: Date.now() - startTime,
          error,
          state,
          jobId,
          next,
        });

        // Stop executing if the error is sufficiently severe
        if (error.severity === 'crash' || error.severity === 'kill') {
          throw error;
        }
      } else {
        // It should be impossible to get here
        throw e;
      }
    }

    if (!didError) {
      const humanDuration = logger.timer(timerId);
      logger.success(`Completed step ${jobName} in ${humanDuration}`);

      // Take a memory snapshot
      // IMPORTANT: this runs _after_ the state object has been serialized
      // Which has a big impact on memory
      // This is reasonable I think because your final state is part of the job!
      const { heapUsed, rss } = process.memoryUsage();

      const jobMemory = heapUsed;
      const systemMemory = rss;

      const humanJobMemory = Math.round(jobMemory / 1024 / 1024);
      const humanSystemMemory = Math.round(systemMemory / 1024 / 1024);
      logger.debug(
        `Final memory usage: [step ${humanJobMemory}mb] [system ${humanSystemMemory}mb]`
      );

      next = calculateNext(step, result, logger);
      notify(NOTIFY_JOB_COMPLETE, {
        duration: Date.now() - duration,
        state: result,
        jobId,
        next,
        mem: {
          job: jobMemory,
          system: systemMemory,
        },
      });
    }
  } else {
    // calculate next for trigger nodes
    next = calculateNext(step, result, logger);
  }

  if (next.length && !didError && !result) {
    logger.warn(
      `WARNING: step ${stepId} did not return a state object. This may cause downstream jobs to fail.`
    );
  }

  return { next, state: result };
};

export default executeStep;
