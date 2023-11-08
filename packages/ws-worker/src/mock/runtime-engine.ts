import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { ExecutionPlan, JobNode } from '@openfn/runtime';
import * as engine from '@openfn/engine-multi';
import { timestamp } from '@openfn/logger';

import type { State } from '../types';
import mockResolvers from './resolvers';

export type EngineEvent =
  | typeof engine.JOB_COMPLETE
  | typeof engine.JOB_START
  | typeof engine.WORKFLOW_COMPLETE
  | typeof engine.WORKFLOW_ERROR
  | typeof engine.WORKFLOW_LOG
  | typeof engine.WORKFLOW_START;

export type JobStartEvent = {
  workflowId: string;
  jobId: string;
  runId: string; // run id. Not sure we need this.
};

export type JobCompleteEvent = {
  workflowId: string;
  jobId: string;
  state: State; // do we really want to publish the intermediate events? Could be important, but also could be sensitive
  // I suppose at this level yes, we should publish it
};

export type WorkflowStartEvent = {
  workflowId: string;
};

export type WorkflowCompleteEvent = {
  workflowId: string;
  error?: any; // hmm maybe not
};

export type WorkflowErrorEvent = {
  workflowId: string;
  message: string;
};

async function createMock() {
  const activeWorkflows = {} as Record<string, true>;
  const bus = new EventEmitter();
  const listeners: Record<string, any> = {};

  const dispatch = (type: EngineEvent, args?: any) => {
    if (args.workflowId) {
      listeners[args.workflowId]?.[type]?.(args);
    }
    // TODO add performance metrics to every event?
    bus.emit(type, args);
  };

  const on = (event: EngineEvent, fn: (evt: any) => void) => bus.on(event, fn);

  const once = (event: EngineEvent, fn: (evt: any) => void) =>
    bus.once(event, fn);

  // Listens to events for a particular workflow/execution plan
  // TODO: Listeners will be removed when the plan is complete (?)
  const listen = (
    planId: string,
    events: Record<keyof JobCompleteEvent, (evt: any) => void>
  ) => {
    listeners[planId] = events;
  };

  const executeJob = async (
    workflowId: string,
    job: JobNode,
    initialState = {},
    resolvers: engine.Resolvers = mockResolvers
  ) => {
    const { id, expression, configuration, adaptor } = job;

    // If no expression or adaptor, this is (probably) a trigger node.
    // Silently do nothing
    if (!expression && !adaptor) {
      return initialState;
    }

    const runId = crypto.randomUUID();

    const jobId = id;
    if (typeof configuration === 'string') {
      // Fetch the credential but do nothing with it
      // Maybe later we use it to assemble state
      await resolvers.credential?.(configuration);
    }

    const info = (...message: any[]) => {
      dispatch('workflow-log', {
        workflowId,
        message: message,
        level: 'info',
        time: timestamp().toString(),
        name: 'mck',
      });
    };

    // Get the job details from lightning
    // start instantly and emit as it goes
    dispatch('job-start', { workflowId, jobId, runId });
    info('Running job ' + jobId);
    let nextState = initialState;

    // @ts-ignore
    if (expression?.startsWith?.('wait@')) {
      const [_, delay] = (expression as string).split('@');
      nextState = initialState;
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), parseInt(delay));
      });
    } else {
      // Try and parse the expression as JSON, in which case we use it as the final state
      try {
        // @ts-ignore
        nextState = JSON.parse(expression);
        // What does this look like? Should be a logger object
        info('Parsing expression as JSON state');
        info(nextState);
      } catch (e) {
        // Do nothing, it's fine
        nextState = initialState;
      }
    }

    dispatch('job-complete', { workflowId, jobId, state: nextState, runId });

    return nextState;
  };

  // Start executing an ExecutionPlan
  // The mock uses lots of timeouts to make testing a bit easier and simulate asynchronicity
  const execute = (
    xplan: ExecutionPlan,
    options: { resolvers?: engine.Resolvers; throw?: boolean } = {
      resolvers: mockResolvers,
    }
  ) => {
    // This is just an easy way to test the options gets fed through to execute
    // Also lets me test error handling!
    if (options.throw) {
      throw new Error('test error');
    }

    const { id, jobs, initialState } = xplan;
    const workflowId = id;
    activeWorkflows[id!] = true;

    // TODO do we want to load a globals dataclip from job.state here?
    // This isn't supported right now
    // We would need to use resolvers.dataclip if we wanted it

    setTimeout(() => {
      dispatch('workflow-start', { workflowId });
      setTimeout(async () => {
        let state = initialState || {};
        // Trivial job reducer in our mock
        for (const job of jobs) {
          state = await executeJob(id!, job, state, options.resolvers);
        }
        setTimeout(() => {
          delete activeWorkflows[id!];
          dispatch('workflow-complete', { workflowId });
          // TODO on workflow complete we should maybe tidy the listeners?
          // Doesn't really matter in the mock though
        }, 1);
      }, 1);
    }, 1);
  };

  // return a list of jobs in progress
  const getStatus = () => {
    return {
      active: Object.keys(activeWorkflows).length,
    };
  };

  return {
    on,
    once,
    execute,
    getStatus,
    listen,
  };
}

export default createMock;
