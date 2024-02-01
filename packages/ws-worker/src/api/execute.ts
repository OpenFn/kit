import {
  RUN_COMPLETE,
  RUN_LOG,
  RunLogPayload,
  RUN_START,
  RunStartPayload,
  GET_CREDENTIAL,
  GET_DATACLIP,
  STEP_COMPLETE,
  STEP_START,
} from '../events';
import {
  getWithReply,
  createRunState,
  throttle as createThrottle,
} from '../util';
import handleStepComplete from '../events/step-complete';
import handleStepStart from '../events/step-start';
import handleRunComplete from '../events/run-complete';
import handleRunError from '../events/run-error';

import type { RunOptions, Channel, RunState, JSONLog } from '../types';
import type { Logger } from '@openfn/logger';
import type {
  RuntimeEngine,
  Resolvers,
  WorkflowStartPayload,
} from '@openfn/engine-multi';
import type { ExecutionPlan } from '@openfn/runtime';

const enc = new TextDecoder('utf-8');

export { handleStepComplete, handleStepStart };

export type Context = {
  channel: Channel;
  state: RunState;
  logger: Logger;
  engine: RuntimeEngine;
  onFinish: (result: any) => void;

  // maybe its better for version numbers to be scribbled here as we go?
};

// mapping engine events to lightning events
const eventMap = {
  'workflow-start': RUN_START,
  'job-start': STEP_START,
  'job-complete': STEP_COMPLETE,
  'workflow-log': RUN_LOG,
  'workflow-complete': RUN_COMPLETE,
};

// pass a web socket connected to the run channel
// this thing will do all the work
export function execute(
  channel: Channel,
  engine: RuntimeEngine,
  logger: Logger,
  plan: ExecutionPlan,
  options: RunOptions = {},
  onFinish = (_result: any) => {}
) {
  logger.info('executing ', plan.id);

  const state = createRunState(plan, options);

  const context: Context = { channel, state, logger, engine, onFinish };

  const throttle = createThrottle();

  type EventHandler = (context: any, event: any) => void;

  // Utility function to:
  // a) bind an event handler to a runtime-engine event
  // b) pass the context object into the hander
  // c) log the response from the websocket from lightning
  // TODO for debugging and monitoring, we should also send events to the worker's event emitter
  const addEvent = (eventName: string, handler: EventHandler) => {
    const wrappedFn = async (event: any) => {
      // TODO this logging is in the wrong place
      // This actually logs errors coming out of the worker
      // But it presents as logging from messages being send to lightning
      // really this messaging should move into send event

      // @ts-ignore
      const lightningEvent = eventMap[eventName] ?? eventName;
      try {
        await handler(context, event);
        logger.info(`${plan.id} :: ${lightningEvent} :: OK`);
      } catch (e: any) {
        logger.error(
          `${plan.id} :: ${lightningEvent} :: ERR: ${e.message || e.toString()}`
        );
        logger.error(e);
      }
    };
    return {
      [eventName]: wrappedFn,
    };
  };

  // TODO listeners need to be called in a strict queue
  // so that they send in order
  const listeners = Object.assign(
    {},
    addEvent('workflow-start', throttle(onWorkflowStart)),
    addEvent('job-start', throttle(handleStepStart)),
    addEvent('job-complete', throttle(handleStepComplete)),
    addEvent('job-error', throttle(onJobError)),
    addEvent('workflow-log', throttle(onJobLog)),
    // This will also resolve the promise
    addEvent('workflow-complete', throttle(handleRunComplete)),

    addEvent('workflow-error', throttle(handleRunError))

    // TODO send autoinstall logs
  );
  engine.listen(plan.id!, listeners);

  const resolvers = {
    credential: (id: string) => loadCredential(channel, id),

    // TODO not supported right now
    // dataclip: (id: string) => loadDataclip(channel, id),
  } as Resolvers;

  Promise.resolve()
    // Optionally resolve initial state
    .then(async () => {
      // TODO we need to remove this from here and let the runtime take care of it through
      // the resolver. See https://github.com/OpenFn/kit/issues/403
      if (typeof plan.initialState === 'string') {
        logger.debug('loading dataclip', plan.initialState);
        plan.initialState = await loadDataclip(channel, plan.initialState);
        logger.success('dataclip loaded');
        logger.debug(plan.initialState);
      }
      return plan;
    })
    // Execute (which we have to wrap in a promise chain to handle initial state)
    .then(() => {
      try {
        engine.execute(plan, { resolvers, ...options });
      } catch (e: any) {
        // TODO what if there's an error?
        handleRunError(context, {
          workflowId: plan.id!,
          message: e.message,
          type: e.type,
          severity: e.severity,
        });
      }
    });

  return context;
}

// async/await wrapper to push to a channel
// TODO move into utils I think?
export const sendEvent = <T>(channel: Channel, event: string, payload?: any) =>
  new Promise((resolve, reject) => {
    channel
      .push<T>(event, payload)
      .receive('error', reject)
      .receive('timeout', () => {
        reject(new Error('timeout'));
      })
      .receive('ok', resolve);
  });

// TODO move all event handlers into api/events/*

// Called on job fail or crash
// If this was a crash, it'll also trigger a workflow error
// But first we update the reason for this failed job
export function onJobError(context: Context, event: any) {
  // Error is the same as complete, but we might report
  // a different complete reason

  // awkward error handling
  // If the error is written to state, it's a fail,
  // and we don't want to send that to handleStepComplete
  // because it'll count it as a crash
  // This isn't very good: maybe we shouldn't trigger an error
  // at all for a fail state?
  const { state, error, jobId } = event;
  // This test is horrible too
  if (state?.errors?.[jobId]?.message === error.message) {
    return handleStepComplete(context, event);
  } else {
    return handleStepComplete(context, event, event.error);
  }
}

export function onWorkflowStart(
  { channel }: Context,
  _event: WorkflowStartPayload
) {
  return sendEvent<RunStartPayload>(channel, RUN_START);
}

export function onJobLog({ channel, state }: Context, event: JSONLog) {
  const timeInMicroseconds = BigInt(event.time) / BigInt(1e3);

  // lightning-friendly log object
  const log: RunLogPayload = {
    run_id: state.plan.id!,
    // The message body, the actual thing that is logged,
    // may be always encoded into a string
    // Parse it here before sending on to lightning
    // TODO this needs optimising!
    message:
      typeof event.message === 'string'
        ? JSON.parse(event.message)
        : event.message,
    source: event.name,
    level: event.level,
    timestamp: timeInMicroseconds.toString(),
  };

  if (state.activeStep) {
    log.step_id = state.activeStep;
  }

  return sendEvent<RunLogPayload>(channel, RUN_LOG, log);
}

export async function loadDataclip(channel: Channel, stateId: string) {
  const result = await getWithReply<Uint8Array>(channel, GET_DATACLIP, {
    id: stateId,
  });
  const str = enc.decode(new Uint8Array(result));
  return JSON.parse(str);
}

export async function loadCredential(channel: Channel, credentialId: string) {
  return getWithReply(channel, GET_CREDENTIAL, { id: credentialId });
}
