import crypto from 'node:crypto';

import {
  ATTEMPT_COMPLETE,
  AttemptCompletePayload,
  ATTEMPT_LOG,
  AttemptLogPayload,
  ATTEMPT_START,
  AttemptStartPayload,
  GET_CREDENTIAL,
  GET_DATACLIP,
  RUN_COMPLETE,
  RunCompletePayload,
  RUN_START,
  RunStartPayload,
} from '../events';
import { AttemptOptions, Channel, AttemptState } from '../types';
import { getWithReply, stringify, createAttemptState } from '../util';

import type { JSONLog, Logger } from '@openfn/logger';
import type {
  RuntimeEngine,
  Resolvers,
  JobCompletePayload,
  WorkflowCompletePayload,
  WorkflowErrorPayload,
  WorkflowStartPayload,
} from '@openfn/engine-multi';
import { ExecutionPlan } from '@openfn/runtime';
import { calculateAttemptExitReason, calculateJobExitReason } from './reasons';

const enc = new TextDecoder('utf-8');

export type Context = {
  channel: Channel;
  state: AttemptState;
  logger: Logger;
  onFinish: (result: any) => void;
};

// mapping engine events to lightning events
const eventMap = {
  'workflow-start': ATTEMPT_START,
  'job-start': RUN_START,
  'job-complete': RUN_COMPLETE,
  'workflow-log': ATTEMPT_LOG,
  'workflow-complete': ATTEMPT_COMPLETE,
};

// pass a web socket connected to the attempt channel
// this thing will do all the work
export function execute(
  channel: Channel,
  engine: RuntimeEngine,
  logger: Logger,
  plan: ExecutionPlan,
  options: AttemptOptions = {},
  onFinish = (_result: any) => {}
) {
  logger.info('executing ', plan.id);

  const state = createAttemptState(plan, options);

  const context: Context = { channel, state, logger, onFinish };

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
        onWorkflowError(context, {
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
      .receive('timeout', () => reject(new Error('timeout')))
      .receive('ok', resolve);
  });

// TODO maybe move all event handlers into api/events/*

export function onJobStart({ channel, state }: Context, event: any) {
  // generate a run id and write it to state
  state.activeRun = crypto.randomUUID();
  state.activeJob = event.jobId;

  const input_dataclip_id = state.inputDataclips[event.jobId];

  return sendEvent<RunStartPayload>(channel, RUN_START, {
    run_id: state.activeRun!,
    job_id: state.activeJob!,
    input_dataclip_id,
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
  if (state?.errors?.[jobId]?.message === error.message) {
    return onJobComplete(context, event);
  } else {
    return onJobComplete(context, event, event.error);
  }
}

// OK, what we need to do now is:
// a) generate a reason string for the job
// b) save the reason for each job to state for later
export function onJobComplete(
  { channel, state }: Context,
  event: JobCompletePayload,
  // TODO this isn't terribly graceful, but accept an error for crashes
  error?: any
) {
  const dataclipId = crypto.randomUUID();

  const run_id = state.activeRun as string;
  const job_id = state.activeJob as string;

  if (!state.dataclips) {
    state.dataclips = {};
  }

  const outputState = event.state || {};

  // Ensure the event has some minimal state to report back to lightning
  state.dataclips[dataclipId] = outputState;

  delete state.activeRun;
  delete state.activeJob;
  // TODO right now, the last job to run will be the result for the attempt
  // this may not stand up in the future
  // I'd feel happer if the runtime could judge what the final result is
  // (taking into account branches and stuff)
  // The problem is that the runtime will return the object, not an id,
  // so we have a bit of a mapping problem
  state.lastDataclipId = dataclipId;

  // Set the input dataclip id for downstream jobs
  event.next?.forEach((nextJobId) => {
    state.inputDataclips[nextJobId] = dataclipId;
  });

  const { reason, error_message, error_type } = calculateJobExitReason(
    job_id,
    outputState,
    error
  );
  state.reasons[job_id] = { reason, error_message, error_type };

  const evt = {
    run_id,
    job_id,
    output_dataclip_id: dataclipId,
    output_dataclip: stringify(outputState),

    reason,
    error_message,
    error_type,

    mem: event.mem,
    duration: event.duration,
    thread_id: event.threadId,
  };
  return sendEvent<RunCompletePayload>(channel, RUN_COMPLETE, evt);
}

export function onWorkflowStart(
  { channel }: Context,
  _event: WorkflowStartPayload
) {
  return sendEvent<AttemptStartPayload>(channel, ATTEMPT_START);
}

export async function onWorkflowComplete(
  { state, channel, onFinish }: Context,
  _event: WorkflowCompletePayload
) {
  // TODO I dont think the attempt final dataclip IS the last job dataclip
  // Especially not in parallelisation
  const result = state.dataclips[state.lastDataclipId!];
  const reason = calculateAttemptExitReason(state);
  await sendEvent<AttemptCompletePayload>(channel, ATTEMPT_COMPLETE, {
    final_dataclip_id: state.lastDataclipId!,
    ...reason,
  });
  onFinish({ reason, state: result });
}

export async function onWorkflowError(
  context: Context,
  event: WorkflowErrorPayload
) {
  const { state, channel, logger, onFinish } = context;

  try {
    // Ok, let's try that, let's just generate a reason from the event
    const reason = calculateJobExitReason('', { data: {} }, event);

    // If there's a job still running, make sure it gets marked complete
    if (state.activeJob) {
      await onJobError(context, { error: event });
    }

    await sendEvent<AttemptCompletePayload>(channel, ATTEMPT_COMPLETE, {
      final_dataclip_id: state.lastDataclipId!,
      ...reason,
    });

    onFinish({ reason });
  } catch (e: any) {
    logger.error('ERROR in workflow-error handler:', e.message);
    logger.error(e);

    onFinish({});
  }
}

export function onJobLog({ channel, state }: Context, event: JSONLog) {
  const timeInMicroseconds = BigInt(event.time) / BigInt(1e3);

  // lightning-friendly log object
  const log: AttemptLogPayload = {
    attempt_id: state.plan.id!,
    message: event.message,
    source: event.name,
    level: event.level,
    timestamp: timeInMicroseconds.toString(),
  };

  if (state.activeRun) {
    log.run_id = state.activeRun;
  }

  return sendEvent<AttemptLogPayload>(channel, ATTEMPT_LOG, log);
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
