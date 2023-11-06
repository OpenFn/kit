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
import { AttemptOptions, Channel } from '../types';
import { getWithReply, stringify } from '../util';

import type { JSONLog, Logger } from '@openfn/logger';
import {
  WorkflowCompleteEvent,
  WorkflowErrorEvent,
  WorkflowStartEvent,
} from '../mock/runtime-engine';
import type { RuntimeEngine, Resolvers } from '@openfn/engine-multi';
import { ExecutionPlan } from '@openfn/runtime';

const enc = new TextDecoder('utf-8');

export type AttemptState = {
  activeRun?: string;
  activeJob?: string;
  plan: ExecutionPlan;
  options: AttemptOptions;
  dataclips: Record<string, any>;

  // final dataclip id
  lastDataclipId?: string;
};

type Context = {
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
  log: ATTEMPT_LOG,
  'workflow-complete': ATTEMPT_COMPLETE,
};

// pass a web socket connected to the attempt channel
// this thing will do all the work
export function execute(
  channel: Channel,
  engine: RuntimeEngine,
  logger: Logger,
  plan: ExecutionPlan,
  options: AttemptOptions = {}
) {
  return new Promise(async (resolve, reject) => {
    logger.info('execute...');

    const state: AttemptState = {
      plan,
      // set the result data clip id (which needs renaming)
      // to the initial state
      lastDataclipId: plan.initialState as string | undefined,
      dataclips: {},
      options,
    };

    const context: Context = { channel, state, logger, onComplete: resolve };

    type EventHandler = (context: any, event: any) => void;

    // Utility function to:
    // a) bind an event handler to a runtime-engine event
    // b) pass the context object into the hander
    // c) log the response from the websocket from lightning
    const addEvent = (eventName: string, handler: EventHandler) => {
      const wrappedFn = async (event: any) => {
        // @ts-ignore
        const lightningEvent = eventMap[eventName];
        try {
          await handler(context, event);
          logger.info(`${plan.id} :: ${lightningEvent} :: OK`);
        } catch (e: any) {
          logger.error(
            `${plan.id} :: ${lightningEvent} :: ERR: ${
              e.message || e.toString()
            }`
          );
          logger.error(e);
        }
      };
      return {
        [eventName]: wrappedFn,
      };
    };

    // TODO we should wait for each event to complete before sending the next one
    // Eg wait for a large dataclip to upload back to lightning before starting the next job
    // should we actually defer exeuction, or just the reporting?
    // Does it matter if logs aren't sent back in order?
    // There are some practical requirements
    // like we can't post a log until the job start has been acknowledged by Lightning
    // (ie until the run was created at lightning's end)
    // that probably means we need to cache here rather than slow down the runtime?
    const listeners = Object.assign(
      {},
      addEvent('workflow-start', onWorkflowStart),
      addEvent('job-start', onJobStart),
      addEvent('job-complete', onJobComplete),
      addEvent('workflow-log', onJobLog),
      // This will also resolve the promise
      addEvent('workflow-complete', onWorkflowComplete),

      addEvent('workflow-error', onWorkflowError)

      // TODO send autoinstall logs
      // are these associated with a workflow...?
      // well, I guess they can be!
      // Or is this just a log?
      // Or a generic metric?
    );
    engine.listen(plan.id!, listeners);

    const resolvers = {
      credential: (id: string) => loadCredential(channel, id),

      // TODO not supported right now
      // dataclip: (id: string) => loadDataclip(channel, id),
    } as Resolvers;

    // TODO we nede to remove this from here nad let the runtime take care of it through
    // the resolver. See https://github.com/OpenFn/kit/issues/403
    if (typeof plan.initialState === 'string') {
      logger.debug('loading dataclip', plan.initialState);
      plan.initialState = await loadDataclip(channel, plan.initialState);
      logger.success('dataclip loaded');
      logger.debug(plan.initialState);
    }

    try {
      engine.execute(plan, { resolvers, ...options });
    } catch (e: any) {
      // TODO what if there's an error?
      onWorkflowError(context, { workflowId: plan.id!, message: e.message });
      // are we sure we want to re-throw?
      reject(e);
    }
  });
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

export function onJobComplete({ channel, state }: Context, event: any) {
  const dataclipId = crypto.randomUUID();

  const run_id = state.activeRun;
  const job_id = state.activeJob;

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

  return sendEvent<RUN_COMPLETE_PAYLOAD>(channel, RUN_COMPLETE, {
    run_id,
    job_id,
    output_dataclip_id: dataclipId,
    output_dataclip: stringify(event.state),
    reason: 'success',
  });
}

export function onWorkflowStart(
  { channel }: Context,
  _event: WorkflowStartEvent
) {
  return sendEvent<ATTEMPT_START_PAYLOAD>(channel, ATTEMPT_START);
}

export async function onWorkflowComplete(
  { state, channel, onComplete }: Context,
  _event: WorkflowCompleteEvent
) {
  const result = state.dataclips[state.lastDataclipId!];

  await sendEvent<ATTEMPT_COMPLETE_PAYLOAD>(channel, ATTEMPT_COMPLETE, {
    final_dataclip_id: state.lastDataclipId!,
    status: 'success', // TODO
    reason: 'ok', // Also TODO
  });

  onComplete(result);
}

// On errorr, for now, we just post to workflow complete
// No unit tests on this (not least because I think it'll change soon)
export async function onWorkflowError(
  { state, channel, onComplete }: Context,
  event: WorkflowErrorEvent
) {
  await sendEvent<ATTEMPT_COMPLETE_PAYLOAD>(channel, ATTEMPT_COMPLETE, {
    reason: 'fail', // TODO
    final_dataclip_id: state.lastDataclipId!,
    message: event.message,
  });

  onComplete({});
}

export function onJobLog({ channel, state }: Context, event: JSONLog) {
  // lightning-friendly log object
  const log: ATTEMPT_LOG_PAYLOAD = {
    attempt_id: state.plan.id!,
    message: event.message,
    source: event.name,
    level: event.level,
    timestamp: event.time || Date.now(),
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
