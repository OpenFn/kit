// TODO not crazy about this file name
// This is the module responsible for interfacing between the Lightning websocket
// and the RTM
// It's the actual meat and potatoes of the implementation
// You can almost read this as a binding function and a bunch of handlers
// it isn't an actual worker, but a BRIDGE between a worker and lightning
import crypto from 'node:crypto';
import phx from 'phoenix-channels';
import { JSONLog } from '@openfn/logger';
import convertAttempt from './util/convert-attempt';
// this managers the worker
//i would like functions to be testable, and I'd like the logic to be readable

import { ATTEMPT_LOG, GET_ATTEMPT, RUN_COMPLETE, RUN_START } from './events';
import { Attempt } from './types';
import { ExecutionPlan } from '@openfn/runtime';

export type AttemptState = {
  activeRun?: string;
  activeJob?: string;
  plan: ExecutionPlan;
};

type Channel = typeof phx.Channel;

// TODO move to util
const getWithReply = (channel: Channel, event: string, payload?: any) =>
  new Promise((resolve) => {
    channel.push(event, payload).receive('ok', (evt: any) => {
      resolve(evt);
    });
    // TODO handle errors amd timeouts too
  });

export function onJobStart(
  channel: Channel,
  state: AttemptState,
  jobId: string
) {
  // generate a run id
  // write it to state
  state.activeRun = crypto.randomUUID();
  state.activeJob = jobId;

  // post the correct event to the lightning via websocket
  // do we need to wait for a response? Well, not yet.

  channel.push(RUN_START, {
    run_id: state.activeJob,
    job_id: state.activeJob,

    // input_dataclip_id what about this guy?
  });
}

export function onJobComplete(
  channel: Channel,
  state: AttemptState,
  jobId: string
) {
  channel.push(RUN_COMPLETE, {
    run_id: state.activeJob,
    job_id: state.activeJob,
    // input_dataclip_id what about this guy?
  });

  delete state.activeRun;
  delete state.activeJob;
}

export function onJobLog(channel: Channel, state: AttemptState, log: JSONLog) {
  // we basically just forward the log to lightning
  // but we also need to attach the log id
  const evt = {
    ...log,
    attempt_id: state.plan.id,
  };
  if (state.activeRun) {
    evt.run_id = state.activeRun;
  }
  channel.push(ATTEMPT_LOG, evt);
}

export async function prepareAttempt(channel: Channel) {
  // first we get the attempt body through the socket
  const attemptBody = (await getWithReply(channel, GET_ATTEMPT)) as Attempt;

  // then we generate the execution plan
  const plan = convertAttempt(attemptBody);

  return plan;
  // difficulty: we need to tell the rtm how to callback for
  // credentials and state (which should both be lazy and part of the run)
  // I guess this is generic - given an attempt id I can lookup the channel and return this information
  // then we call the excute function. Or return the promise and let someone else do that
}

// These are the functions that lazy load data from lightning
// Is it appropriate first join the channel? Should there be some pooling?
async function loadState(ws, attemptId, stateId) {}

async function loadCredential(ws, attemptId, stateId) {}

// pass a web socket connected to the attempt channel
// this thing will do all the work
// TODO actually this now is a Workflow or Execution plan
// It's not an attempt anymore
export function execute(channel: Channel, rtm, plan: ExecutionPlan) {
  // tracking state for this attempt
  const state: AttemptState = {
    //attempt, // keep this on the state so that anyone can access it
    plan,
  };

  // listen to rtm events
  // what if I can do this
  // this is super declarative
  // TODO is there any danger of events coming through out of order?
  // what if onJoblog takes 1 second to finish and before the runId is set, onJobLog comes through?
  rtm.listen(plan.id, {
    'job-start': (evt) => onJobStart(plan, state, evt),
    'job-complete': (evt) => onJobComplete(plan, state, evt),
    'job-log': (evt) => onJobLog(plan, state, evt),
  });

  rtm.execute(plan);
}
