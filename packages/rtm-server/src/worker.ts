// TODO not crazy about this file name
// This is the module responsible for interfacing between the Lightning websocket
// and the RTM
// It's the actual meat and potatoes of the implementation
// You can almost read this as a binding function and a bunch of handlers
// it isn't an actual worker, but a BRIDGE between a worker and lightning
import crypto from 'node:crypto';

import convertAttempt from './util/convert-attempt';
// this managers the worker
//i would like functions to be testable, and I'd like the logic to be readable

import { GET_ATTEMPT, RUN_START } from './events';

type Channel = any; // phx.Channel

// TODO move to util
const getWithReply = (channel, event: string, payload?: any) =>
  new Promise((resolve) => {
    channel.push(event, payload).receive('ok', (evt: any) => {
      resolve(evt);
    });
    // TODO handle errors amd timeouts too
  });

function onJobStart(channel, state, jobId) {
  // generate a run id
  // write it to state
  state.jobId = crypto.randomUUID();

  // post the correct event to the lightning via websocket
  // do we need to wait for a response? Well, not yet.

  channel.push(RUN_START, {
    id: state.jobId,
    job_id: jobId,
    // input_dataclip_id what about this guy?
  });
}

function onJobLog(channel, state) {
  // we basically just forward the log to lightning
  // but we also need to attach the log id
}

// TODO actually I think this is prepare
export async function prepareAttempt(channel: Channel) {
  // first we get the attempt body through the socket
  const attemptBody = await getWithReply(channel, GET_ATTEMPT);

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
function execute(channel, rtm, attempt) {
  // tracking state for this attempt
  const state = {
    runId: '',
  };

  // listen to rtm events
  // what if I can do this
  // this is super declarative
  rtm.listen(attemptId, {
    'job-start': (evt) => onJobStart(ws, state, evt),
    'job-log': (evt) => onJobLog(ws, state),
  });

  rtm.execute(attempt);
}
