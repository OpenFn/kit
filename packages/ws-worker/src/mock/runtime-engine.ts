import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { ExecutionPlan, JobNode } from '@openfn/runtime';

import type { State, Credential } from '../types';
import mockResolvers from './resolvers';

// A mock runtime engine

// Runs ExecutionPlans(XPlans) in worker threads
// May need to lazy-load resources
// The mock engine will return expression JSON as state

type Resolver<T> = (id: string) => Promise<T>;

// A list of helper functions which basically resolve ids into JSON
// to lazy load assets
export type LazyResolvers = {
  credentials?: Resolver<Credential>;
  state?: Resolver<State>;
  expressions?: Resolver<string>;
};

export type EngineEvent =
  | 'job-start'
  | 'job-complete'
  | 'log' // this is a log from inside the VM
  | 'workflow-start' // before compile
  | 'workflow-complete' // after everything has run
  | 'workflow-error'; // ?

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
  error?: any;
};

let autoServerId = 0;

function createMock(serverId?: string) {
  const activeWorkflows = {} as Record<string, true>;
  const bus = new EventEmitter();
  const listeners: Record<string, any> = {};

  const dispatch = (type: EngineEvent, args?: any) => {
    // console.log(' > ', type, args);
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
    resolvers: LazyResolvers = mockResolvers
  ) => {
    const { id, expression, configuration } = job;

    const runId = crypto.randomUUID();

    const jobId = id;
    if (typeof configuration === 'string') {
      // Fetch the credential but do nothing with it
      // Maybe later we use it to assemble state
      await resolvers.credential(configuration);
    }

    const info = (...message: any[]) => {
      dispatch('log', {
        workflowId,
        message: message,
        level: 'info',
        timestamp: Date.now(),
        name: 'mck',
      });
    };

    // Get the job details from lightning
    // start instantly and emit as it goes
    dispatch('job-start', { workflowId, jobId, runId });
    info('Running job ' + jobId);
    let nextState = initialState;
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

    dispatch('job-complete', { workflowId, jobId, state: nextState, runId });

    return nextState;
  };

  // Start executing an ExecutionPlan
  // The mock uses lots of timeouts to make testing a bit easier and simulate asynchronicity
  const execute = async (
    xplan: ExecutionPlan,
    resolvers: LazyResolvers = mockResolvers
  ) => {
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
          state = await executeJob(id!, job, state, resolvers);
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
    id: serverId || `${++autoServerId}`,
    on,
    once,
    execute,
    getStatus,
    setResolvers: (r: LazyResolvers) => {
      resolvers = r;
    },
    listen,
  };
}

export default createMock;
