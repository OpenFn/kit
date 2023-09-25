import { EventEmitter } from 'node:events';
import type { ExecutionPlan } from '@openfn/runtime';

import type { State, Credential } from '../types';
import mockResolvers from './resolvers';

// A mock runtime manager
// Runs ExecutionPlans(XPlans) in worker threads
// May need to lazy-load resources
// The mock RTM will return expression JSON as state

type Resolver<T> = (id: string) => Promise<T>;

// A list of helper functions which basically resolve ids into JSON
// to lazy load assets
export type LazyResolvers = {
  credentials?: Resolver<Credential>;
  state?: Resolver<State>;
  expressions?: Resolver<string>;
};

export type RTMEvent =
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
  state?: object;
  error?: any;
};

// TODO log event optionally has a job id

let jobId = 0;
const getNewJobId = () => `${++jobId}`;

let autoServerId = 0;

// Before we execute each job (expression), we have to build a state object
// This means squashing together the input state and the credential
// The credential of course is the hard bit
const assembleState = () => {};

function createMock(
  serverId?: string,
  resolvers: LazyResolvers = mockResolvers
) {
  const activeWorkflows = {} as Record<string, true>;
  const bus = new EventEmitter();
  const listeners: Record<string, any> = {};

  const dispatch = (type: RTMEvent, args?: any) => {
    console.log(' > ', type, args);
    if (args.workflowId) {
      listeners[args.workflowId]?.[type]?.(args);
    }
    // TODO add performance metrics to every event?
    bus.emit(type, args);

    // TOOD return an unsubscribe API?
  };

  const on = (event: RTMEvent, fn: (evt: any) => void) => {
    bus.on(event, fn);
  };
  const once = (event: RTMEvent, fn: (evt: any) => void) => {
    bus.once(event, fn);
  };

  // Listens to events for a particular workflow/execution plan
  // TODO: Listeners will be removed when the plan is complete (?)
  const listen = (
    planId: string,
    events: Record<keyof JobCompleteEvent, (evt: any) => void>
  ) => {
    listeners[planId] = events;
  };

  const executeJob = async (workflowId, job: JobPlan, initialState = {}) => {
    // TODO maybe lazy load the job from an id
    const { id, expression, configuration } = job;
    const jobId = id;
    if (typeof configuration === 'string') {
      // Fetch the credential but do nothing with it
      // Maybe later we use it to assemble state
      await resolvers.credentials(configuration);
    }

    // Does a job reallly need its own id...? Maybe.
    const runId = getNewJobId();

    // Get the job details from lightning
    // start instantly and emit as it goes
    dispatch('job-start', { workflowId, jobId });

    let state = initialState;
    // Try and parse the expression as JSON, in which case we use it as the final state
    try {
      state = JSON.parse(expression);
      // What does this look like? Should be a logger object
      dispatch('log', {
        workflowId,
        jobId,
        message: ['Parsing expression as JSON state'],
      });
      dispatch('log', { workflowId, jobId, message: [state] });
    } catch (e) {
      // Do nothing, it's fine
    }

    dispatch('job-complete', { workflowId, jobId, state });

    return state;
  };

  // Start executing an ExecutionPlan
  // The mock uses lots of timeouts to make testing a bit easier and simulate asynchronicity
  const execute = (xplan: ExecutionPlan) => {
    console.log('[mockrtm] execute');
    console.log(xplan);
    const { id, jobs } = xplan;
    const workflowId = id;
    activeWorkflows[id!] = true;
    setTimeout(() => {
      console.log('[mockrtm] start');
      dispatch('workflow-start', { workflowId });
      setTimeout(async () => {
        let state = {};
        // Trivial job reducer in our mock
        for (const job of jobs) {
          state = await executeJob(id, job, state);
        }
        setTimeout(() => {
          delete activeWorkflows[id!];
          console.log('[mockrtm] complete');
          console.log(state);
          dispatch('workflow-complete', { workflowId, state });
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
