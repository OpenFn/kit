import { WORKFLOW_COMPLETE, WORKFLOW_LOG, WORKFLOW_START } from '../events';
import {
  EngineAPI,
  ExecutionContext,
  WorkerCompletePayload,
  WorkerLogPayload,
  WorkerStartPayload,
  WorkflowState,
} from '../types';

export const workflowStart = (
  context: ExecutionContext,
  event: WorkerStartPayload // the event published by the runtime itself ({ workflowId, threadId })
) => {
  const { state, logger } = context;
  const { workflowId, threadId } = event;

  logger.info('starting workflow ', workflowId);

  // where would this throw get caught?
  if (state.startTime) {
    // TODO this shouldn't throw.. but what do we do?
    // We shouldn't run a workflow that's been run
    // Every workflow should have a unique id
    // maybe the RTM doesn't care about this
    throw new Error(`Workflow with id ${workflowId} is already started`);
  }

  Object.assign(state, {
    status: 'running',
    startTime: Date.now(),
    duration: -1,
    threadId: threadId,
  });

  // TODO do we still want to push this into the active workflows array?
  // api.activeWorkflows.push(workflowId);

  // forward the event on to any external listeners
  context.emit(WORKFLOW_START, {
    workflowId, // if this is a bespoke emitter it can be implied, which is nice
    // Should we publish anything else here?
  });
};

export const workflowComplete = (
  context: ExecutionContext,
  event: WorkerCompletePayload // the event published by the runtime itself ({ workflowId, threadId })
) => {
  const { logger, state } = context;
  const { workflowId, state: result, threadId } = event;

  logger.success('complete workflow ', workflowId);
  logger.info(state);

  // TODO I don't know how we'd get here in this architecture
  // if (!allWorkflows.has(workflowId)) {
  //   throw new Error(`Workflow with id ${workflowId} is not defined`);
  // }

  state.status = 'done';
  state.result = result;
  state.duration = Date.now() - state.startTime!;

  // TODO do we have to remove this from the active workflows array?
  // const idx = activeWorkflows.findIndex((id) => id === workflowId);
  // activeWorkflows.splice(idx, 1);

  // forward the event on to any external listeners
  context.emit(WORKFLOW_COMPLETE, {
    workflowId: workflowId,
    threadId,
    duration: state.duration,
    state: result,
  });
};

export const log = (
  context: ExecutionContext,
  event: WorkerLogPayload // the event published by the runtime itself ({ workflowId, threadId })
) => {
  const { id } = context.state;
  // // TODO not sure about this stuff, I think we can drop it?
  // const newMessage = {
  //   ...message,
  //   // Prefix the job id in all local jobs
  //   // I'm sure there are nicer, more elegant ways of doing this
  //   message: [`[${workflowId}]`, ...message.message],
  // };
  context.logger.proxy(event.message);

  context.emit(WORKFLOW_LOG, {
    workflowId: id,
    ...event.message,
  });
};

// TODO jobstart
// TODO jobcomplete
