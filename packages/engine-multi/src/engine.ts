import { EventEmitter } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExecutionPlan } from '@openfn/runtime';

import { WORKFLOW_COMPLETE, WORKFLOW_LOG, WORKFLOW_START } from './events';
import initWorkers from './api/call-worker';
import createState from './api/create-state';
import execute from './api/execute';

import type { RTEOptions } from './api';
import type {
  EngineAPI,
  EngineEvents,
  EventHandler,
  WorkflowState,
} from './types';

// For each workflow, create an API object with its own event emitter
// this is a bt wierd - what if the emitter went on state instead?
const createWorkflowEvents = (api: EngineAPI, workflowId: string) => {
  //create a bespoke event emitter
  const events = new EventEmitter();

  // proxy all events to the main emitter
  // uh actually there may be no point in this
  function proxy(event: string) {
    events.on(event, (evt) => {
      // ensure the attempt id is on the event
      evt.workflowId = workflowId;
      const newEvt = {
        ...evt,
        workflowId: workflowId,
      };

      api.emit(event, newEvt);
    });
  }
  proxy(WORKFLOW_START);
  proxy(WORKFLOW_COMPLETE);
  // proxy(JOB_START);
  // proxy(JOB_COMPLETE);
  proxy(WORKFLOW_LOG);

  return events;
};

// TODO this is a quick and dirty to get my own claass name in the console
// (rather than EventEmitter)
// But I should probably lean in to the class more for typing and stuff
class Engine extends EventEmitter {}

// TODO this is actually the api that each execution gets
// its nice to separate that from the engine a bit
class ExecutionContext extends EventEmitter {
  constructor(workflowState, logger, callWorker) {
    super();
    this.logger = logger;
    this.callWorker = callWorker;
    this.state = workflowState;
  }
}

// This creates the internal API
// tbh this is actually the engine, right, this is where stuff happens
// the api file is more about the public api I think
const createEngine = (options: RTEOptions, workerPath?: string) => {
  // internal state
  const allWorkflows: Map<string, WorkflowState> = new Map();
  const listeners = {};
  // TODO I think this is for later
  //const activeWorkflows: string[] = [];

  let resolvedWorkerPath;
  if (workerPath) {
    // If a path to the worker has been passed in, just use it verbatim
    // We use this to pass a mock worker for testing purposes
    resolvedWorkerPath = workerPath;
  } else {
    // By default, we load ./worker.js but can't rely on the working dir to find it
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    resolvedWorkerPath = path.resolve(dirname, workerPath || './worker.js');
  }
  options.logger.debug('Loading workers from ', resolvedWorkerPath);

  const engine = new Engine() as EngineAPI;

  initWorkers(engine, resolvedWorkerPath);

  // TODO I think this needs to be like:
  // take a plan
  // create, register and return  a state object
  // should it also load the initial data clip?
  // when does that happen? No, that's inside execute
  const registerWorkflow = (plan: ExecutionPlan) => {
    // TODO throw if already registered?
    const state = createState(plan);
    allWorkflows[state.id] = state;
    return state;
  };

  const getWorkflowState = (workflowId: string) => allWorkflows[workflowId];

  const getWorkflowStatus = (workflowId: string) =>
    allWorkflows[workflowId]?.status;

  // TODO are we totally sure this takes a standard xplan?
  const executeWrapper = (plan: ExecutionPlan) => {
    const state = registerWorkflow(plan);

    const events = createWorkflowEvents(engine, plan.id);
    listeners[plan.id] = events;

    // this context API thing is the internal api / engine
    // each has a bespoke event emitter but otherwise a common interface
    // const api: EngineAPI = {
    //   ...engine,
    //   ...events,
    // };
    // yeah this feels nasty
    // also in debugging the name will be wrong
    // i think maybe we just do new Engine(state)
    // and that creates an API with shared state
    // also this internal engine is a bit different
    // i think it's just logger and events?
    // so I'm back to it being a context. Interesting.
    // Ok so now we have an executioncontext, which I'll create soon
    // maybe it should just have state on it
    const api = Object.assign(events, {
      // workerPath: resolvedWorkerPath,
      logger: options.logger,
      callWorker: engine.callWorker,
      // registerWorkflow,
      // getWorkflowState,
      // getWorkflowStatus,
      // execute: executeWrapper,
      // listen,
    });

    execute(api, state, options);

    // return the event emitter
    return events;
  };

  const listen = (
    workflowId: string,
    handlers: Record<EngineEvents, EventHandler>
  ) => {
    const events = listeners[workflowId];
    for (const evt in handlers) {
      events.on(evt, handlers[evt]);
    }

    // TODO return unsubscribe handle
  };

  engine.emit('test');

  return Object.assign(engine, {
    workerPath: resolvedWorkerPath,
    logger: options.logger,
    registerWorkflow,
    getWorkflowState,
    getWorkflowStatus,
    execute: executeWrapper,
    listen,
  });
};

export default createEngine;
