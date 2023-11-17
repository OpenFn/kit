import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import run, { ExecutionPlan, JobNode, NotifyEvents } from '@openfn/runtime';
import * as engine from '@openfn/engine-multi';
import mockResolvers from './resolvers';

export type EngineEvent =
  | typeof engine.JOB_COMPLETE
  | typeof engine.JOB_START
  | typeof engine.WORKFLOW_COMPLETE
  | typeof engine.WORKFLOW_ERROR
  | typeof engine.WORKFLOW_LOG
  | typeof engine.WORKFLOW_START;

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

// this is basically a fake adaptor
// these functions will be injected into scope
// maybe
// needs me to add the globals option to the runtime
// (which is fine)
const helpers = {};

// The mock runtime engine creates a fake engine interface
// around a real runtime engine
// Note that it  does not dispatch runtime logs and only supports console.log
// This gives us real eventing in the worker tests
// TODO - even better would be to re-use the engine's event map or something
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
    events: Record<keyof engine.EventMap, (evt: any) => void>
  ) => {
    listeners[planId] = events;
  };

  const execute = async (
    xplan: ExecutionPlan,
    options: { resolvers?: engine.Resolvers; throw?: boolean } = {
      resolvers: mockResolvers,
    }
  ) => {
    const { id, jobs } = xplan;
    activeWorkflows[id!] = true;

    // Call the crendtial callback, but don't do anything with it
    for (const job of jobs) {
      if (typeof job.configuration === 'string') {
        job.configuration = await options.resolvers.credential?.(
          job.configuration
        );
      }
    }

    // TODO do I need a more sophisticated solution here?
    const jobLogger = {
      log: (...args) => {
        dispatch('workflow-log', {
          workflowId: id,
          level: 'info',
          json: true,
          message: args,
        });
      },
    };

    const opts = {
      strict: false,
      // logger?
      jobLogger,
      // linker?
      ...options,
      callbacks: {
        notify: (name: NotifyEvents, payload: any) => {
          // console.log(name, payload);
          // TODO events need to be mapped into runtime engine events (noot runtime events)
          dispatch(name, {
            workflowId: id,
            ...payload, // ?
          });
        },
      },
    };
    setTimeout(async () => {
      dispatch('workflow-start', { workflowId: id });

      await run(xplan, undefined, opts);

      delete activeWorkflows[id!];
      dispatch('workflow-complete', { workflowId: id });
    }, 1);

    // Technically the engine should return an event emitter
    // But as I don't think we use it, I'm happy to ignore this
  };

  // const executeJob = async (
  //   workflowId: string,
  //   job: JobNode,
  //   initialState = {},
  //   resolvers: engine.Resolvers = mockResolvers
  // ) => {
  //   const { id, expression, configuration, adaptor } = job;

  //   // If no expression or adaptor, this is (probably) a trigger node.
  //   // Silently do nothing
  //   if (!expression && !adaptor) {
  //     return initialState;
  //   }

  //   const runId = crypto.randomUUID();

  //   const jobId = id;
  //   if (typeof configuration === 'string') {
  //     // Fetch the credential but do nothing with it
  //     // Maybe later we use it to assemble state
  //     await resolvers.credential?.(configuration);
  //   }

  //   const info = (...message: any[]) => {
  //     dispatch('workflow-log', {
  //       workflowId,
  //       message: message,
  //       level: 'info',
  //       time: (BigInt(Date.now()) * BigInt(1e3)).toString(),
  //       name: 'mck',
  //     });
  //   };

  //   // Get the job details from lightning
  //   // start instantly and emit as it goes
  //   dispatch('job-start', { workflowId, jobId, runId });
  //   info('Running job ' + jobId);
  //   let nextState = initialState;

  //   // @ts-ignore
  //   if (expression?.startsWith?.('wait@')) {
  //     const [_, delay] = (expression as string).split('@');
  //     nextState = initialState;
  //     await new Promise<void>((resolve) => {
  //       setTimeout(() => resolve(), parseInt(delay));
  //     });
  //   } else {
  //     // Try and parse the expression as JSON, in which case we use it as the final state
  //     try {
  //       // @ts-ignore
  //       nextState = JSON.parse(expression);
  //       // What does this look like? Should be a logger object
  //       info('Parsing expression as JSON state');
  //       info(nextState);
  //     } catch (e) {
  //       // Do nothing, it's fine
  //       nextState = initialState;
  //     }
  //   }

  //   dispatch('job-complete', {
  //     workflowId,
  //     jobId,
  //     state: nextState,
  //     runId,
  //     next: [], // TODO hmm. I think we need to do better than this.
  //   });

  //   return nextState;
  // };

  // // Start executing an ExecutionPlan
  // // The mock uses lots of timeouts to make testing a bit easier and simulate asynchronicity
  // const execute = (
  //   xplan: ExecutionPlan,
  //   options: { resolvers?: engine.Resolvers; throw?: boolean } = {
  //     resolvers: mockResolvers,
  //   }
  // ) => {
  //   // This is just an easy way to test the options gets fed through to execute
  //   // Also lets me test error handling!
  //   if (options.throw) {
  //     throw new Error('test error');
  //   }

  //   const { id, jobs, initialState } = xplan;
  //   const workflowId = id;
  //   activeWorkflows[id!] = true;

  //   // TODO do we want to load a globals dataclip from job.state here?
  //   // This isn't supported right now
  //   // We would need to use resolvers.dataclip if we wanted it

  //   setTimeout(() => {
  //     dispatch('workflow-start', { workflowId });
  //     setTimeout(async () => {
  //       let state = initialState || {};
  //       // Trivial job reducer in our mock
  //       for (const job of jobs) {
  //         state = await executeJob(id!, job, state, options.resolvers);
  //       }
  //       setTimeout(() => {
  //         delete activeWorkflows[id!];
  //         dispatch('workflow-complete', { workflowId });
  //         // TODO on workflow complete we should maybe tidy the listeners?
  //         // Doesn't really matter in the mock though
  //       }, 1);
  //     }, 1);
  //   }, 1);
  // };

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
