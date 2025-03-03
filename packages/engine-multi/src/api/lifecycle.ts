// here's here things get a bit complex event wise
import * as externalEvents from '../events';
import * as internalEvents from '../worker/events';
import type ExecutionContext from '../classes/ExecutionContext';
import { timestamp } from '@openfn/logger';

// Log events from the inner thread will be logged to stdout
// EXCEPT the keys listed here
const logsToExcludeFromStdout = /(job)|(ada)/i;

export const workflowStart = (
  context: ExecutionContext,
  event: internalEvents.WorkflowStartEvent
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
  context.emit(externalEvents.WORKFLOW_START, {
    threadId,
    versions: context.versions,
    time: timestamp(),
  });
};

export const workflowComplete = (
  context: ExecutionContext,
  event: internalEvents.WorkflowCompleteEvent
) => {
  const { logger, state } = context;
  const { workflowId, state: result, threadId } = event;

  logger.success('complete workflow ', workflowId);
  //logger.info(event.state);

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
  context.emit(externalEvents.WORKFLOW_COMPLETE, {
    threadId,
    duration: state.duration,
    state: result,
    time: timestamp(),
  });
};

export const jobStart = (
  context: ExecutionContext,
  event: internalEvents.JobStartEvent
) => {
  console.log(' >> JOB START');
  const { threadId, jobId } = event;

  context.emit(externalEvents.JOB_START, {
    jobId,
    threadId,
    time: timestamp(),
  });
};

export const jobComplete = (
  context: ExecutionContext,
  event: internalEvents.JobCompleteEvent
) => {
  console.log(' >> JOB COMPLETE');
  const { threadId, state, duration, jobId, next, mem } = event;

  context.emit(externalEvents.JOB_COMPLETE, {
    threadId,
    state,
    duration,
    jobId,
    next,
    mem,
    time: timestamp(),
  });
};

// TODO this is not unit tested
// (and not likely to be today)
export const jobError = (
  context: ExecutionContext,
  event: internalEvents.JobErrorEvent
) => {
  const { threadId, state, error, duration, jobId, next } = event;
  context.emit(externalEvents.JOB_ERROR, {
    threadId,
    state,
    error,
    duration,
    jobId,
    next,
    time: timestamp(),
  });
};

export const log = (
  context: ExecutionContext,
  event: internalEvents.LogEvent
) => {
  const { threadId } = event;

  if (!logsToExcludeFromStdout.test(event.log.name!)) {
    // Forward the log event to the engine's logger
    // Note that we may have to parse the serialized log string
    const proxy = {
      ...event.log,
      message:
        typeof event.log.message == 'string'
          ? JSON.parse(event.log.message)
          : event.log.message,
    };
    context.logger.proxy(proxy);
  }

  context.emit(externalEvents.WORKFLOW_LOG, {
    threadId,
    ...event.log,
  });
};

export const error = (
  context: ExecutionContext,
  event: internalEvents.ErrorEvent
) => {
  const { threadId = '-', error } = event;
  context.emit(externalEvents.WORKFLOW_ERROR, {
    threadId,
    // @ts-ignore
    type: error.type || error.name || 'ERROR',
    message: error.message || error.toString(),
    // default to exception because if we don't know, it's our fault
    severity: error.severity || 'exception',
  });
};
