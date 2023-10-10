import createLogger, { JSONLog, Logger } from '@openfn/logger';
import { EngineAPI, EngineEvents, EventHandler } from './types';
import { EventEmitter } from 'node:events';
import { WORKFLOW_COMPLETE, WORKFLOW_START } from './events';

import initWorkers from './api/call-worker';

// For each workflow, create an API object with its own event emitter
// this is a bt wierd - what if the emitter went on state instead?
const createWorkflowEvents = (api: EngineAPI) => {
  //create a bespoke event emitter
  const events = new EventEmitter();

  // TODO need this in closure really
  // listeners[workflowId] = events;

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
  proxy(JOB_START);
  proxy(JOB_COMPLETE);
  proxy(LOG);

  return events;
};

const createAPI = (repoDir: string, options) => {
  const listeners = {};

  // but this is more like an internal api, right?
  // maybe this is like the workflow context
  const state = {
    workflows: {},
  }; // TODO maybe this sits in another file
  // the state has apis for getting/setting workflow state
  // maybe actually each execute setsup its own state object

  // TODO I think there's an internal and external API
  // api is the external thing that other people call
  // engine is the internal thing
  const api = new EventEmitter() as EngineAPI;

  api.logger = options.logger || createLogger('RTE', { level: 'debug' });

  api.registerWorkflow = (state) => {
    state.workflows[plan.id] = state;
  };

  // what if this returns a bespoke event listener?
  // i don't need to to execute(); listen, i can just excute
  // it's kinda slick but you still need two lines of code and it doesn't  buy anyone anything
  // also this is nevver gonna get used externally so it doesn't need to be slick
  api.execute = (executionPlan) => {
    const workflowId = plan.id;

    // Pull options out of the plan so that all options are in one place
    const { options, ...plan } = executionPlan;

    // initial state for this workflow run
    // TODO let's create a util function for this (nice for testing)
    const state = createState(plan);
    // the engine does need to be able to report on the state of each workflow
    api.registerWorkflow(state);

    const events = createWorkflowEvents(api);

    listeners[workflowId] = events;

    // this context API thing is the internal api / engine
    // each has a bespoke event emitter but otherwise a common interface
    const contextAPI: EngineAPI = {
      ...api,
      ...events,
    };

    execute(contextAPI, state, options);

    // return the event emitter (not the full engine API though)
    return events;
  };

  // // how will this actually work?
  // api.listen = (
  //   attemptId: string,
  //   listeners: Record<EngineEvents, EventHandler>
  // ) => {
  //   // const handler = (eventName) => {
  //   //   if ()
  //   // }
  //   const events = listeners[workflowId];
  //   for (const evt of listeners) {
  //     events.on(evt, listeners[evt]);
  //   }

  //   // TODO return unsubscribe handle
  // };

  // we can have global reporting like this
  api.getStatus = (workflowId) => state.workflows[workflowId].status;

  initWorkers(api);

  return api;
};

export default createAPI;
