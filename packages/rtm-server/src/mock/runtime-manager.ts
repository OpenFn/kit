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
  id: string; // job id
  runId: string; // run id. Not sure we need this.
};

export type JobCompleteEvent = {
  id: string; // job id
  runId: string; // run id. Not sure we need this.
  state: State; // do we really want to publish the intermediate events? Could be important, but also could be sensitive
  // I suppose at this level yes, we should publish it
};

export type WorkflowStartEvent = {
  id: string; // workflow id
};

export type WorkflowCompleteEvent = {
  id: string; // workflow id
  state?: object;
  error?: any;
};

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

  const dispatch = (type: RTMEvent, args?: any) => {
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

  const executeJob = async (job: JobPlan, initialState = {}) => {
    // TODO maybe lazy load the job from an id
    const { id, expression, configuration } = job;
    if (typeof configuration === 'string') {
      // Fetch the credntial but do nothing with it
      // Maybe later we use it to assemble state
      await resolvers.credentials(configuration);
    }

    // Does a job reallly need its own id...? Maybe.
    const runId = getNewJobId();

    // Get the job details from lightning
    // start instantly and emit as it goes
    dispatch('job-start', { id, runId });

    let state = initialState;
    // Try and parse the expression as JSON, in which case we use it as the final state
    try {
      state = JSON.parse(expression);
      // What does this look like? Should be a logger object
      dispatch('log', { message: ['Parsing expression as JSON state'] });
      dispatch('log', { message: [state] });
    } catch (e) {
      // Do nothing, it's fine
    }

    dispatch('job-complete', { id, runId, state });

    return state;
  };

  // Start executing an ExecutionPlan
  // The mock uses lots of timeouts to make testing a bit easier and simulate asynchronicity
  const execute = (xplan: ExecutionPlan) => {
    const { id, jobs } = xplan;
    activeWorkflows[id!] = true;
    setTimeout(() => {
      dispatch('workflow-start', { id });
      setTimeout(async () => {
        let state = {};
        // Trivial job reducer in our mock
        for (const job of jobs) {
          state = await executeJob(job, state);
        }
        setTimeout(() => {
          delete activeWorkflows[id!];
          dispatch('workflow-complete', { id, state });
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
  };
}

export default createMock;
