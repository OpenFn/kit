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
  GET_DATACLIP_PAYLOAD,
  RUN_COMPLETE,
  RUN_COMPLETE_PAYLOAD,
  RUN_START,
  RUN_START_PAYLOAD,
} from '../events';
import { Channel } from '../types';
import { getWithReply, stringify } from '../util';

import type { ExecutionPlan } from '@openfn/runtime';
import type { JSONLog, Logger } from '@openfn/logger';
import {
  WorkflowCompleteEvent,
  WorkflowStartEvent,
} from '../mock/runtime-engine';

const enc = new TextDecoder('utf-8');

export type AttemptState = {
  activeRun?: string;
  activeJob?: string;
  plan: ExecutionPlan;
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

// pass a web socket connected to the attempt channel
// this thing will do all the work
export function execute(
  channel: Channel,
  engine: any, // TODO typing!
  logger: Logger,
  // TODO first thing we'll do here is pull the plan
  plan: ExecutionPlan
) {
  return new Promise(async (resolve) => {
    logger.info('execute..');
    // TODO add proper logger (maybe channel, rtm and logger comprise a context object)
    // tracking state for this attempt
    const state: AttemptState = {
      plan,
      // set the result data clip id (which needs renaming)
      // to the initial state
      lastDataclipId: plan.initialState as string | undefined,
    };

    const context: Context = { channel, state, logger, onComplete: resolve };

    type EventHandler = (context: any, event: any) => void;

    // Utility funciton to
    // a) bind an event handler to a event
    // b) pass the contexdt object into the hander
    // c) log the event
    const addEvent = (eventName: string, handler: EventHandler) => {
      const wrappedFn = (event: any) => {
        logger.info(`${plan.id} :: ${eventName}`);
        handler(context, event);
      };
      return {
        [eventName]: wrappedFn,
      };
    };

    // TODO we should wait for each event to complete before sending the next one
    // Eg wait for a large dataclip to upload back to lightning before starting the next job
    // should we actually defer exeuction, or just the reporting?
    // Does it matter if logs aren't sent back in order?
    const listeners = Object.assign(
      {},
      addEvent('workflow-start', onWorkflowStart),
      addEvent('job-start', onJobStart),
      addEvent('job-complete', onJobComplete),
      addEvent('log', onJobLog),
      // This will also resolve the promise
      addEvent('workflow-complete', onWorkflowComplete)
    );
    engine.listen(plan.id, listeners);

    const resolvers = {
      credential: (id: string) => loadCredential(channel, id),
      // dataclip: (id: string) => loadDataclip(channel, id),
      // TODO not supported right now
    };

    if (typeof plan.initialState === 'string') {
      logger.debug('loading dataclip', plan.initialState);
      plan.initialState = await loadDataclip(channel, plan.initialState);
      logger.success('dataclip loaded');
      logger.debug(plan.initialState);
    }

    engine.execute(plan, resolvers);
  });
}

// TODO maybe move all event handlers into api/events/*

export function onJobStart({ channel, state }: Context, event: any) {
  // generate a run id and write it to state
  state.activeRun = crypto.randomUUID();
  state.activeJob = event.jobId;
  const evt = {
    run_id: state.activeRun!,
    job_id: state.activeJob!,
    input_dataclip_id: state.lastDataclipId,
  };
  console.log('>>', evt);
  channel.push<RUN_START_PAYLOAD>(RUN_START, evt).receive('error', (e) => {
    console.error('run start error', e);
  });
}

export function onJobComplete({ channel, state }: Context, event: any) {
  const dataclipId = crypto.randomUUID();

  channel.push<RUN_COMPLETE_PAYLOAD>(RUN_COMPLETE, {
    run_id: event.jobId,
    job_id: state.activeJob!,
    output_dataclip_id: dataclipId,
    output_dataclip: stringify(event.state),
    reason: "success"  // HAND WAVE, change me!
  });

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
}

export function onWorkflowStart(
  { channel }: Context,
  _event: WorkflowStartEvent
) {
  channel.push<ATTEMPT_START_PAYLOAD>(ATTEMPT_START);
}

export function onWorkflowComplete(
  { state, channel, onComplete }: Context,
  _event: WorkflowCompleteEvent
) {
  const result = state.dataclips[state.lastDataclipId!];

  channel
    .push<ATTEMPT_COMPLETE_PAYLOAD>(ATTEMPT_COMPLETE, {
      final_dataclip_id: state.lastDataclipId!,
      status: 'success', // TODO
    })
    .receive('ok', () => {
      onComplete(result);
    });
}

export function onJobLog({ channel, state }: Context, event: JSONLog) {
  console.log(event);

  // lightning-friendly log object
  const newLog: ATTEMPT_LOG_PAYLOAD = {
    attempt_id: state.plan.id!,
    message: event.message,
    source: event.name,
    timestamp: event.time || Date.now(),
  };
  if (state.activeRun) {
    newLog.run_id = state.activeRun;
  }

  // TODO wrap a push with standard error and ok handlers
  // like, maybe we only log after hte log was sent? Or log once for sending and once for acknowledged (either way)?
  channel
    .push<ATTEMPT_LOG_PAYLOAD>(ATTEMPT_LOG, newLog)
    .receive('error', (e) => {
      console.error('log error', e);
    });
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
