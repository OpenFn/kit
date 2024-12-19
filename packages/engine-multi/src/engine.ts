import { EventEmitter } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExecutionPlan, State } from '@openfn/lexicon';
import type { Logger } from '@openfn/logger';

import {
  JOB_COMPLETE,
  JOB_START,
  WORKFLOW_COMPLETE,
  WORKFLOW_LOG,
  WORKFLOW_START,
} from './events';
import initWorkers from './api/call-worker';
import createState from './util/create-state';
import execute from './api/execute';
import validateWorker from './api/validate-worker';
import ExecutionContext from './classes/ExecutionContext';

import type { LazyResolvers } from './api';
import type {
  EngineAPI,
  EventHandler,
  ExecuteOptions,
  RuntimeEngine,
  WorkflowState,
} from './types';
import type { AutoinstallOptions } from './api/autoinstall';

const DEFAULT_RUN_TIMEOUT = 1000 * 60 * 10; // ms

const DEFAULT_MEMORY_LIMIT_MB = 500;

// For each workflow, create an API object with its own event emitter
// this is a bit weird - what if the emitter went on state instead?
const createWorkflowEvents = (
  engine: EngineAPI,
  context: ExecutionContext,
  workflowId: string
) => {
  // proxy all events to the main emitter
  // uh actually there may be no point in this
  function proxy(event: string) {
    context.on(event, (evt) => {
      // ensure the run id is on the event
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

export type EngineOptions = {
  autoinstall?: AutoinstallOptions;
  // compile?: { skip?: boolean } // TODO no support yet
  logger: Logger;
  maxWorkers?: number;
  memoryLimitMb?: number;
  noCompile?: boolean; // TODO deprecate in favour of compile
  repoDir: string;
  resolvers?: LazyResolvers;
  runtimelogger?: Logger;
  runTimeoutMs?: number; // default timeout
  statePropsToRemove?: string[];
  whitelist?: RegExp[];
};

export type InternalEngine = RuntimeEngine & {
  // TODO Not a very good type definition, but it calms the tests down
  [other: string]: any;
};

// This creates the internal API
// tbh this is actually the engine, right, this is where stuff happens
// the api file is more about the public api I think
// TOOD options MUST have a logger
const createEngine = async (
  options: EngineOptions,
  workerPath?: string
): Promise<InternalEngine> => {
  const states: Record<string, WorkflowState> = {};
  const contexts: Record<string, ExecutionContext> = {};
  const deferredListeners: Record<string, Record<string, EventHandler>[]> = {};

  const defaultTimeout = options.runTimeoutMs || DEFAULT_RUN_TIMEOUT;
  const defaultMemoryLimit = options.memoryLimitMb || DEFAULT_MEMORY_LIMIT_MB;

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
      workerPath || '../dist/worker/thread/run.js'
    );
  }

  options.logger!.debug('Loading workers from ', resolvedWorkerPath);

  const engine = new Engine() as EngineAPI;

  const { callWorker, closeWorkers, workers } = initWorkers(
    resolvedWorkerPath,
    {
      maxWorkers: options.maxWorkers,
    },
    options.logger
  );
  engine.callWorker = callWorker;

  await validateWorker(engine);

  // TODO I think this needs to be like:
  // take a plan
  // create, register and return  a state object
  // should it also load the initial data clip?
  // when does that happen? No, that's inside execute
  const registerWorkflow = (plan: ExecutionPlan, input: State) => {
    // TODO throw if already registered?
    const state = createState(plan, input);
    states[state.id] = state;
    return state;
  };

  const getWorkflowState = (workflowId: string) => states[workflowId];

  const getWorkflowStatus = (workflowId: string) => states[workflowId]?.status;

  // TODO too much logic in this execute function, needs farming out
  // I don't mind having a wrapper here but it must be super thin
  // TODO maybe engine options is too broad?
  const executeWrapper = (
    plan: ExecutionPlan,
    input: State,
    opts: ExecuteOptions = {}
  ) => {
    options.logger!.debug('executing plan ', plan?.id ?? '<no id>');
    const workflowId = plan.id!;
    // TODO throw if plan is invalid
    // Wait, don't throw because the server will die
    // Maybe return null instead
    const state = registerWorkflow(plan, input);

    const context = new ExecutionContext({
      state,
      logger: options.logger!,
      callWorker,
      options: {
        ...options,
        sanitize: opts.sanitize,
        resolvers: opts.resolvers,
        runTimeoutMs: opts.runTimeoutMs ?? defaultTimeout,
        memoryLimitMb: opts.memoryLimitMb ?? defaultMemoryLimit,
      },
    });

    contexts[workflowId] = createWorkflowEvents(engine, context, workflowId);

    // Hook up any listeners passed to listen() that were called before execute
    if (deferredListeners[workflowId]) {
      deferredListeners[workflowId].forEach((l) => listen(workflowId, l));
      delete deferredListeners[workflowId];
    }

    // Run the execute on a timeout so that consumers have a chance
    // to register listeners
    setTimeout(() => {
      // TODO typing between the class and interface isn't right
      // @ts-ignore
      execute(context).finally(() => {
        delete contexts[workflowId];
      });
    }, 1);

    // hmm. Am I happy to pass the internal workflow state OUT of the handler?
    // I'd rather have like a proxy emitter or something
    // also I really only want passive event handlers, I don't want interference from outside
    return {
      on: (evt: string, fn: (...args: any[]) => void) => context.on(evt, fn),
      once: (evt: string, fn: (...args: any[]) => void) =>
        context.once(evt, fn),
      off: (evt: string, fn: (...args: any[]) => void) => context.off(evt, fn),
    };
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

  const destroy = (instant?: boolean) => closeWorkers(instant);

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
    workers,
  });
};

export default createEngine;
