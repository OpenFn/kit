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
  // final state/dataclip
  result?: any;

  // TODO status?
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
  plan: ExecutionPlan
) {
  return new Promise((resolve) => {
    // TODO add proper logger (maybe channel, rtm and logger comprise a context object)
    // tracking state for this attempt
    const state: AttemptState = {
      plan,
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
      state: (id: string) => loadState(channel, id),
      credential: (id: string) => loadCredential(channel, id),
    };

    engine.execute(plan, resolvers);
  });
}

// TODO maybe move all event handlers into api/events/*

export function onJobStart({ channel, state }: Context, event: any) {
  // generate a run id and write it to state
  state.activeRun = crypto.randomUUID();
  state.activeJob = event;

  channel.push<RUN_START_PAYLOAD>(RUN_START, {
    run_id: state.activeJob!,
    job_id: state.activeJob!,
    // input_dataclip_id what about this guy?
  });
}

export function onJobComplete({ channel, state }: Context, event: any) {
  channel.push<RUN_COMPLETE_PAYLOAD>(RUN_COMPLETE, {
    run_id: state.activeRun!,
    job_id: state.activeJob!,
    // TODO generate a dataclip id
    output_dataclip: stringify(event.state),
  });

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
  event: WorkflowCompleteEvent
) {
  state.result = event.state;

  channel
    .push<ATTEMPT_COMPLETE_PAYLOAD>(ATTEMPT_COMPLETE, {
      dataclip: stringify(event.state), // TODO this should just be dataclip id
    })
    .receive('ok', () => {
      onComplete(state.result);
    });
}

export function onJobLog({ channel, state }: Context, event: JSONLog) {
  // we basically just forward the log to lightning
  // but we also need to attach the log id
  const evt: ATTEMPT_LOG_PAYLOAD = {
    ...event,
    attempt_id: state.plan.id!,
  };
  if (state.activeRun) {
    evt.run_id = state.activeRun;
  }
  channel.push<ATTEMPT_LOG_PAYLOAD>(ATTEMPT_LOG, evt);
}

export async function loadState(channel: Channel, stateId: string) {
  const result = await getWithReply<Uint8Array>(channel, GET_DATACLIP, {
    dataclip_id: stateId,
  });
  const str = enc.decode(new Uint8Array(result));
  return JSON.parse(str);
}

export async function loadCredential(channel: Channel, credentialId: string) {
  return getWithReply(channel, GET_CREDENTIAL, { credential_id: credentialId });
}
