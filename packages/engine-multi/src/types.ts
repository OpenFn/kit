// ok first of allI want to capture the key interfaces
import { Logger } from '@openfn/logger';
import { ExecutionPlan } from '@openfn/runtime';
import type { EventEmitter } from 'node:events';
import workerpool from 'workerpool';
import { RTEOptions } from './api';

import { ExternalEvents, EventMap } from './events';
import { EngineOptions } from './engine';

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
  events?: any
) => workerpool.Promise<T>;

export type ExecutionContextConstructor = {
  state: WorkflowState;
  logger: Logger;
  callWorker: CallWorker;
  options: EngineOptions;
};

export interface ExecutionContext extends EventEmitter {
  constructor(args: ExecutionContextConstructor): ExecutionContext;
  options: RTEOptions; // TODO maybe. bring them in here?
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

  // TODO my want some maintenance APIs, like getStatus. idk
}
