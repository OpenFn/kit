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
const createWorkflowEvents = (
  engine: EngineAPI,
  context: ExecutionContext,
  workflowId: string
) => {
  // proxy all events to the main emitter
  // uh actually there may be no point in this
  function proxy(event: string) {
    context.on(event, (evt) => {
      // ensure the attempt id is on the event
      evt.workflowId = workflowId;
      const newEvt = {
        ...evt,
        workflowId: workflowId,
      };

      engine.emit(event, newEvt);
    });
  }
  proxy(WORKFLOW_START);
  proxy(WORKFLOW_COMPLETE);
  // proxy(JOB_START);
  // proxy(JOB_COMPLETE);
  proxy(WORKFLOW_LOG);

  return context;
};

// TODO this is a quick and dirty to get my own claass name in the console
// (rather than EventEmitter)
// But I should probably lean in to the class more for typing and stuff
class Engine extends EventEmitter {}

// TODO this is actually the api that each execution gets
// its nice to separate that from the engine a bit
class ExecutionContext extends EventEmitter {
  constructor(workflowState, logger, callWorker, options) {
    super();
    this.logger = logger;
    this.callWorker = callWorker;
    this.state = workflowState;
    this.options = options;
  }
}

// This creates the internal API
// tbh this is actually the engine, right, this is where stuff happens
// the api file is more about the public api I think
const createEngine = (options: RTEOptions, workerPath?: string) => {
  // TODO  this is probably states now, although contexts sort of subsumes it
  const allWorkflows: Map<string, WorkflowState> = new Map();

  // TODO this contexts now
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

    const context = new ExecutionContext(
      state,
      options.logger,
      engine.callWorker,
      options
    );

    listeners[plan.id] = createWorkflowEvents(engine, context, engine, plan.id);

    execute(context);

    // hmm. Am I happy to pass the internal workflow state OUT of the handler?
    // I'd rather have like a proxy emitter or something
    // also I really only want passive event handlers, I don't want interference from outside
    return {
      on: (...args) => context.on(...args),
      once: context.once,
      off: context.off,
    };
    // return context;
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
