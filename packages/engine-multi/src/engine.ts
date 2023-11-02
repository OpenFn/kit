import { EventEmitter } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExecutionPlan } from '@openfn/runtime';
import {
  JOB_COMPLETE,
  JOB_START,
  WORKFLOW_COMPLETE,
  WORKFLOW_LOG,
  WORKFLOW_START,
} from './events';
import initWorkers from './api/call-worker';
import createState from './api/create-state';
import execute from './api/execute';
import validateWorker from './api/validate-worker';
import ExecutionContext from './classes/ExecutionContext';

import type { SanitizePolicies } from '@openfn/logger';
import type { LazyResolvers } from './api';
import type { EngineAPI, EventHandler, WorkflowState } from './types';
import type { Logger } from '@openfn/logger';
import type { AutoinstallOptions } from './api/autoinstall';

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
  proxy(JOB_START);
  proxy(JOB_COMPLETE);
  proxy(WORKFLOW_LOG);

  return context;
};

// TODO this is a quick and dirty to get my own claass name in the console
// (rather than EventEmitter)
// But I should probably lean in to the class more for typing and stuff
class Engine extends EventEmitter {}

// The engine is way more strict about options
export type EngineOptions = {
  repoDir: string;
  logger: Logger;
  runtimelogger?: Logger;

  resolvers?: LazyResolvers;

  noCompile?: boolean; // TODO deprecate in favour of compile

  // compile?: { // TODO no support yet
  //   skip?: boolean;
  // };

  autoinstall?: AutoinstallOptions;

  minWorkers?: number;
  maxWorkers?: number;

  whitelist?: RegExp[];

  // Timeout for the whole workflow
  timeout?: number;
};

export type ExecuteOptions = {
  sanitize?: SanitizePolicies;
  resolvers?: LazyResolvers;
  timeout?: number;
};

// This creates the internal API
// tbh this is actually the engine, right, this is where stuff happens
// the api file is more about the public api I think
// TOOD options MUST have a logger
const createEngine = async (options: EngineOptions, workerPath?: string) => {
  const states: Record<string, WorkflowState> = {};
  const contexts: Record<string, ExecutionContext> = {};
  const deferredListeners: Record<string, Record<string, EventHandler>[]> = {};

  // TODO I think this is for later
  //const activeWorkflows: string[] = [];

  // TOOD I wonder if the engine should a) always accept a worker path
  // and b) validate it before it runs
  let resolvedWorkerPath;
  if (workerPath) {
    // If a path to the worker has been passed in, just use it verbatim
    // We use this to pass a mock worker for testing purposes
    resolvedWorkerPath = workerPath;
  } else {
    // By default, we load ./worker.js but can't rely on the working dir to find it
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    resolvedWorkerPath = path.resolve(
      dirname,
      // TODO there are too many assumptions here, it's an argument for the path just to be
      // passed by the mian api or the unit test
      workerPath || '../dist/worker/worker.js'
    );
  }

  options.logger!.debug('Loading workers from ', resolvedWorkerPath);

  const engine = new Engine() as EngineAPI;

  initWorkers(
    engine,
    resolvedWorkerPath,
    {
      minWorkers: options.minWorkers,
      maxWorkers: options.maxWorkers,
    },
    options.logger
  );

  await validateWorker(engine);

  // TODO I think this needs to be like:
  // take a plan
  // create, register and return  a state object
  // should it also load the initial data clip?
  // when does that happen? No, that's inside execute
  const registerWorkflow = (plan: ExecutionPlan) => {
    // TODO throw if already registered?
    const state = createState(plan);
    states[state.id] = state;
    return state;
  };

  const getWorkflowState = (workflowId: string) => states[workflowId];

  const getWorkflowStatus = (workflowId: string) => states[workflowId]?.status;

  // TODO too much logic in this execute function, needs farming out
  // I don't mind having a wrapper here but it must be super thin
  // TODO maybe engine options is too broad?
  const executeWrapper = (plan: ExecutionPlan, opts: ExecuteOptions = {}) => {
    options.logger!.debug('executing plan ', plan?.id ?? '<no id>');
    const workflowId = plan.id!;
    // TODO throw if plan is invalid
    // Wait, don't throw because the server will die
    // Maybe return null instead
    const state = registerWorkflow(plan);

    const context = new ExecutionContext({
      state,
      logger: options.logger!,
      callWorker: engine.callWorker,
      options: {
        ...options,
        sanitize: opts.sanitize,
        resolvers: opts.resolvers,
        timeout: opts.timeout,
      },
    });

    contexts[workflowId] = createWorkflowEvents(engine, context, workflowId);

    // Hook up any listeners passed to listen() that were called before execute
    if (deferredListeners[workflowId]) {
      deferredListeners[workflowId].forEach((l) => listen(workflowId, l));
      delete deferredListeners[workflowId];
    }

    // TODO typing between the class and interface isn't right
    // @ts-ignore
    execute(context);

    // hmm. Am I happy to pass the internal workflow state OUT of the handler?
    // I'd rather have like a proxy emitter or something
    // also I really only want passive event handlers, I don't want interference from outside
    return {
      on: (evt: string, fn: (...args: any[]) => void) => context.on(evt, fn),
      once: (evt: string, fn: (...args: any[]) => void) =>
        context.once(evt, fn),
      off: (evt: string, fn: (...args: any[]) => void) => context.off(evt, fn),
    };
    // return context;
  };

  const listen = (
    workflowId: string,
    handlers: Record<string, EventHandler>
  ) => {
    const events = contexts[workflowId];
    if (events) {
      // If execute() was called, we'll have a context and we can subscribe directly
      for (const evt in handlers) {
        events.on(evt, handlers[evt]);
      }
    } else {
      // if execute() wasn't called yet, cache the listeners and we'll hook them up later
      if (!deferredListeners[workflowId]) {
        deferredListeners[workflowId] = [];
      }
      deferredListeners[workflowId].push(handlers);
    }

    // TODO return unsubscribe handle?
    // How does this work if deferred?
  };

  const destroy = () => {
    engine.closeWorkers()
  }

  return Object.assign(engine, {
    options,
    workerPath: resolvedWorkerPath,
    logger: options.logger,
    registerWorkflow,
    getWorkflowState,
    getWorkflowStatus,
    execute: executeWrapper,
    listen,
    destroy,
  });
};

export default createEngine;
