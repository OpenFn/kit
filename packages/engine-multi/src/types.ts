// ok first of allI want to capture the key interfaces
import workerpool from 'workerpool';

import type { Logger, SanitizePolicies } from '@openfn/logger';
import type { ExecutionPlan } from '@openfn/runtime';
import type { EventEmitter } from 'node:events';

import type { ExternalEvents, EventMap } from './events';
import type { EngineOptions } from './engine';

export type Resolver<T> = (id: string) => Promise<T>;

export type Resolvers = {
  credential?: Resolver<Credential>;
  state?: Resolver<any>;
};

export type EventHandler = (event: any) => void;

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
  options: any; // TODO this is wf specific options, like logging policy
};

export type CallWorker = <T = any>(
  task: string,
  args: any[],
  events?: any,
  timeout?: number
) => workerpool.Promise<T>;

export type ExecutionContextConstructor = {
  state: WorkflowState;
  logger: Logger;
  callWorker: CallWorker;
  options: ExecutionContextOptions;
};

export type ExecutionContextOptions = EngineOptions & {
  sanitize?: SanitizePolicies;
};

export interface ExecutionContext extends EventEmitter {
  constructor(args: ExecutionContextConstructor): ExecutionContext;
  options: EngineOptions;
  state: WorkflowState;
  logger: Logger;
  callWorker: CallWorker;

  emit<T extends ExternalEvents>(
    event: T,
    payload: Omit<EventMap[T], 'workflowId'>
  ): boolean;
}

export interface EngineAPI extends EventEmitter {
  callWorker: CallWorker;
  closeWorkers: () => void;
}

export interface RuntimeEngine extends EventEmitter {
  //id: string // human readable instance id
  // actually I think the id is on the worker, not the engine

  // TODO should return an unsubscribe hook
  listen(attemptId: string, listeners: any): void;

  // TODO return a promise?
  // Kinda convenient but not actually needed
  execute(
    plan: ExecutionPlan,
    options?: Partial<EngineOptions>
  ): Pick<EventEmitter, 'on' | 'off' | 'once'>;

  destroy(): void;

  // TODO my want some maintenance APIs, like getStatus. idk
}
