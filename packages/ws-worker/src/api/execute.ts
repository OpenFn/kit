import crypto from 'node:crypto';

import {
  ATTEMPT_COMPLETE,
  ATTEMPT_COMPLETE_PAYLOAD,
  ATTEMPT_LOG,
  ATTEMPT_LOG_PAYLOAD,
  ATTEMPT_START,
  ATTEMPT_START_PAYLOAD,
  GET_CREDENTIAL,
  GET_DATACLIP,
  RUN_COMPLETE,
  RUN_COMPLETE_PAYLOAD,
  RUN_START,
  RUN_START_PAYLOAD,
} from '../events';
import { AttemptOptions, Channel, ExitReason } from '../types';
import { getWithReply, stringify } from '../util';

import type { JSONLog, Logger } from '@openfn/logger';
import {
  JobCompleteEvent,
  WorkflowCompleteEvent,
  WorkflowErrorEvent,
  WorkflowStartEvent,
} from '../mock/runtime-engine';
import type { RuntimeEngine, Resolvers } from '@openfn/engine-multi';
import { ExecutionPlan } from '@openfn/runtime';
import { calculateAttemptExitReason, calculateJobExitReason } from './reasons';

const enc = new TextDecoder('utf-8');

export type AttemptState = {
  activeRun?: string;
  activeJob?: string;
  plan: ExecutionPlan;
  options: AttemptOptions;
  dataclips: Record<string, any>;
  reasons: Record<string, ExitReason>;

  // final dataclip id
  lastDataclipId?: string;
};

export type Context = {
  channel: Channel;
  state: AttemptState;
  logger: Logger;
  onComplete: (result: any) => void;
};

// mapping engine events to lightning events
const eventMap = {
  'workflow-start': ATTEMPT_START,
  'job-start': RUN_START,
  'job-complete': RUN_COMPLETE,
  'workflow-log': ATTEMPT_LOG,
  'workflow-complete': ATTEMPT_COMPLETE,
};

export const createAttemptState = (
  plan: ExecutionPlan,
  options: AttemptOptions = {}
): AttemptState => ({
  plan,
  // set the result data clip id (which needs renaming)
  // to the initial state
  lastDataclipId: plan.initialState as string | undefined,
  dataclips: {},
  reasons: {},
  options,
});

// pass a web socket connected to the attempt channel
// this thing will do all the work
export function execute(
  channel: Channel,
  engine: RuntimeEngine,
  logger: Logger,
  plan: ExecutionPlan,
  options: AttemptOptions = {},
  onComplete = (_result: any) => {}
) {
  logger.info('execute...');

  const state = createAttemptState(plan, options);

  const context: Context = { channel, state, logger, onComplete };

  type EventHandler = (context: any, event: any) => void;

  // Utility function to:
  // a) bind an event handler to a runtime-engine event
  // b) pass the context object into the hander
  // c) log the response from the websocket from lightning
  // TODO for debugging and monitoring, we should also send events to the worker's event emitter
  const addEvent = (eventName: string, handler: EventHandler) => {
    const wrappedFn = async (event: any) => {
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

  const listeners = Object.assign(
    {},
    addEvent('workflow-start', onWorkflowStart),
    addEvent('job-start', onJobStart),
    addEvent('job-complete', onJobComplete),
    addEvent('job-error', onJobError),
    addEvent('workflow-log', onJobLog),
    // This will also resolve the promise
    addEvent('workflow-complete', onWorkflowComplete),

    addEvent('workflow-error', onWorkflowError)

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
      // TODO we need to remove this from here nad let the runtime take care of it through
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
        onWorkflowError(context, { workflowId: plan.id!, message: e.message });
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
      .receive('timeout', () => reject(new Error('timeout')))
      .receive('ok', resolve);
  });

// TODO maybe move all event handlers into api/events/*

export function onJobStart({ channel, state }: Context, event: any) {
  // generate a run id and write it to state
  state.activeRun = crypto.randomUUID();
  state.activeJob = event.jobId;
  return sendEvent<RUN_START_PAYLOAD>(channel, RUN_START, {
    run_id: state.activeRun!,
    job_id: state.activeJob!,
    input_dataclip_id: state.lastDataclipId,
  });
}

// Called on job fail or crash
// If this was a crash, it'll also trigger a workflow error
// But first we update the reason for this failed job
export function onJobError(context: Context, event: any) {
  // Error is the same as complete, but we might report
  // a different complete reason

  // akward error handling
  // If the error is written to state, it's a fail,
  // and we don't want to send that to onJobComplete
  // because it'll count it as a crash
  // This isn't very good: maybe we shouldn't trigger an error
  // at all for a fail state?
  const { state, error, jobId } = event;
  // This test is horrible too
  if (state.errors?.[jobId]?.message === error.message) {
    onJobComplete(context, event);
  } else {
    onJobComplete(context, event, event.error);
  }
}

// OK, what we need to do now is:
// a) generate a reason string for the job
// b) save the reason for each job to state for later
export function onJobComplete(
  { channel, state }: Context,
  event: JobCompleteEvent,
  // TODO this isn't terribly graceful, but accept an error for crashes
  error?: any
) {
  const dataclipId = crypto.randomUUID();

  const run_id = state.activeRun as string;
  const job_id = state.activeJob as string;

  if (!state.dataclips) {
    state.dataclips = {};
  }
  state.dataclips[dataclipId] = event.state;

  // TODO right now, the last job to run will be the result for the attempt
  // this may not stand up in the future
  // I'd feel happer if the runtime could judge what the final result is
  // (taking into account branches and stuff)
  // The problem is that the runtime will return the object, not an id,
  // so we have a bit of a mapping problem
  state.lastDataclipId = dataclipId;

  delete state.activeRun;
  delete state.activeJob;
  const { reason, error_message, error_type } = calculateJobExitReason(
    job_id,
    event.state,
    error
  );
  state.reasons[job_id] = { reason, error_message, error_type };

  return sendEvent<RUN_COMPLETE_PAYLOAD>(channel, RUN_COMPLETE, {
    run_id,
    job_id,
    output_dataclip_id: dataclipId,
    output_dataclip: stringify(event.state),

    reason,
    error_message,
    error_type,
  });
}

export function onWorkflowStart(
  { channel }: Context,
  _event: WorkflowStartEvent
) {
  return sendEvent<ATTEMPT_START_PAYLOAD>(channel, ATTEMPT_START);
}

// TODO what this needs to do is look at all the job states
// find the higher priority
// And return that as the highest exit reason
export async function onWorkflowComplete(
  { state, channel, onComplete }: Context,
  _event: WorkflowCompleteEvent
) {
  const result = state.dataclips[state.lastDataclipId!];
  const reason = calculateAttemptExitReason(state);
  await sendEvent<ATTEMPT_COMPLETE_PAYLOAD>(channel, ATTEMPT_COMPLETE, {
    final_dataclip_id: state.lastDataclipId!,
    ...reason,
  });
  onComplete({ reason, state: result });
}

// On error, for now, we just post to workflow complete
// No unit tests on this (not least because I think it'll change soon)
// NB this is a crash state!
export async function onWorkflowError(
  { state, channel, onComplete }: Context,
  event: WorkflowErrorEvent
) {
  // Should we not just report this reason?
  // Nothing more severe can have happened downstream, right?
  // const reason = calculateAttemptExitReason(state);

  // Ok, let's try that, let's just generate a reason from the event
  const reason = calculateJobExitReason('', { data: {} }, event);
  await sendEvent<ATTEMPT_COMPLETE_PAYLOAD>(channel, ATTEMPT_COMPLETE, {
    final_dataclip_id: state.lastDataclipId!,
    ...reason,
  });

  onComplete({ reason });
}

export function onJobLog({ channel, state }: Context, event: JSONLog) {
  const timeInMicroseconds = BigInt(event.time) / BigInt(1e3);

  // lightning-friendly log object
  const log: ATTEMPT_LOG_PAYLOAD = {
    attempt_id: state.plan.id!,
    message: event.message,
    source: event.name,
    level: event.level,
    timestamp: timeInMicroseconds.toString(),
  };

  if (state.activeRun) {
    log.run_id = state.activeRun;
  }

  return sendEvent<ATTEMPT_LOG_PAYLOAD>(channel, ATTEMPT_LOG, log);
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
