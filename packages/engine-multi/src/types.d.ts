// ok first of allI want to capture the key interfaces
import { JSONLog, Logger } from '@openfn/logger';
import { ExecutionPlan } from '@openfn/runtime';
import type { EventEmitter } from 'node:events';
import workerpool from 'workerpool';
import { RTEOptions } from './api';

// These are the external events published but he api and listen
type WorkflowStartEvent = 'workflow-start';
type WorkflowStartPayload = {
  workflowId: string;
};

type WorkflowCompleteEvent = 'workflow-complete';
type WorkflowCompletePayload = {
  workflowId: string;
};

// This occurs when a critical error causes the workflow to be aborted
// ie crash, syntax error
type WorkflowErrorEvent = 'workflow-error';
type WorkflowErrorPayload = {
  workflowId: string;
  type: string;
  message: string;
};

type JobStartEvent = 'job-start';
type JobStartPayload = {
  workflowId: string;
  jobId: string;
};

type JobCompleteEvent = 'job-complete';
type JobCompletePayload = {
  workflowId: string;
  jobId: string;
  state: any; // the result start
};

// a log message coming out of the engine, adaptor or job
type LogEvent = 'job-complete';
type LogPayload = JSONLog & {
  workflowId: string;
};

// TODO
type EdgeResolvedEvent = 'edge-resolved';
type EdgeResolvedPayload = {
  workflowId: string;
  edgeId: string; // interesting, we don't really have this yet. Is index more appropriate? key? yeah, it's target node basically
  result: boolean;
};

type EngineEvents =
  | WorkflowStartEvent
  | WorkflowCompleteEvent
  | JobStartEvent
  | JobCompleteEvent
  | LogEvent;

type EventPayloadLookup = {
  [WorkflowStartEvent]: WorkflowStartPayload;
  [WorkflowCompleteEvent]: WorkflowCompletePayload;
  [JobStartEvent]: JobStartPayload;
  [JobCompleteEvent]: JobCompletePayload;
  [LogEvent]: LogPayload;
};

// These are events from the internal worker (& runtime)

export type WORKER_START = 'worker-start';
export type WorkerStartPayload = {
  threadId: string;
  workflowId: string;
};

export type WORKER_COMPLETE = 'worker-complete';
export type WorkerCompletePayload = {
  threadId: string;
  workflowId: string;
  state: any;
};

// TODO confusion over this and events.ts
export type WORKER_LOG = 'worker-log';
export type WorkerLogPayload = {
  threadId: string;
  workflowId: string;
  message: JSONLog;
};

type EventHandler = <T extends EngineEvents>(
  event: EventPayloadLookup[T]
) => void;

type Resolver<T> = (id: string) => Promise<T>;

type Resolvers = {
  credential?: Resolver<Credential>;
  state?: Resolver<State>;
};

type ExecuteOptions = {
  sanitize: any; // log sanitise options
  noCompile: any; // skip compilation (useful in test)
};

export type WorkflowState = {
  id: string;
  name?: string; // TODO what is name? this is irrelevant?
  status: 'pending' | 'running' | 'done' | 'err';
  threadId?: string;
  startTime?: number;
  duration?: number;
  error?: string;
  result?: any; // State
  plan: ExecutionPlan; // this doesn't include options
  options: any; // TODO this is general engine options and workflow options
};

// this is the internal engine API
export interface ExecutionContext extends EventEmitter {
  options: RTEOptions; // TODO maybe. bring them in here?
  state: WorkflowState;
  logger: Logger;
  callWorker: (
    task: string,
    args: any[] = [],
    events: any = {}
  ) => workerpool.Promise;
}

export interface EngineAPI extends EventEmitter {}

interface RuntimeEngine extends EventEmitter {
  //id: string // human readable instance id
  // actually I think the id is on the worker, not the engine

  // TODO should return an unsubscribe hook
  listen(
    attemptId: string,
    listeners: Record<EngineEvents, EventHandler>
  ): void;

  // TODO return a promise?
  // Kinda convenient but not actually needed
  execute(
    plan: ExecutionPlan,
    resolvers: Resolvers,
    options: ExecuteOptions = {}
  );

  // TODO my want some maintenance APIs, like getStatus. idk
}
