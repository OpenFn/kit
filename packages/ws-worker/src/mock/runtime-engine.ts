import { EventEmitter } from 'node:events';
import run, { ExecutionPlan } from '@openfn/runtime';
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
const helpers = {
  fn: (f: Function) => (s: any) => f(s),
  wait: (duration: number) => (s: any) =>
    new Promise((resolve) => setTimeout(() => resolve(s), duration)),
};

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

    for (const job of jobs) {
      if (typeof job.configuration === 'string') {
        // Call the crendtial callback, but don't do anything with it
        job.configuration = await options.resolvers?.credential?.(
          job.configuration
        );
      }

      // Fake compilation
      if (
        typeof job.expression === 'string' &&
        !(job.expression as string).match(/export default \[/)
      ) {
        job.expression = `export default [${job.expression}];`;
      }
    }

    // TODO do I need a more sophisticated solution here?
    const jobLogger = {
      log: (...args: any[]) => {
        dispatch('workflow-log', {
          workflowId: id,
          level: 'info',
          json: true,
          message: args,
          time: Date.now(),
        });
      },
    };

    const opts = {
      strict: false,
      jobLogger,
      ...options,
      globals: helpers,
      callbacks: {
        notify: (name: any, payload: any) => {
          dispatch(name, {
            workflowId: id,
            ...payload,
          });
        },
      },
    };
    setTimeout(async () => {
      dispatch('workflow-start', { workflowId: id });

      try {
        await run(xplan, undefined, opts as any);
      } catch (e: any) {
        dispatch('workflow-error', {
          workflowId: id,
          type: e.name,
          message: e.message,
        });
      }

      delete activeWorkflows[id!];
      dispatch('workflow-complete', { workflowId: id });
    }, 1);

    // Technically the engine should return an event emitter
    // But as I don't think we use it, I'm happy to ignore this
  };

  // return a list of jobs in progress
  const getStatus = () => {
    return {
      active: Object.keys(activeWorkflows).length,
    };
  };

  const destroy = async () => true;

  return {
    on,
    once,
    execute,
    getStatus,
    listen,
    destroy,
  };
}

export default createMock;
