import type { Logger, SanitizePolicies } from '@openfn/logger';
import type { ExecutionPlan, State, UUID } from '@openfn/lexicon';
import type { EventEmitter } from 'node:events';

import type { EngineOptions } from './engine';
import type { ExecOpts } from './worker/pool';
import { LazyResolvers } from './api';

export type Resolver<T> = (id: string) => Promise<T>;

export type Resolvers = {
  credential?: Resolver<Credential>;
  state?: Resolver<any>;
};

export type EventHandler = (event: any) => void;

export type WorkflowState = {
  id: UUID;
  name?: string; // TODO what is name? this is irrelevant?
  status: 'pending' | 'running' | 'done' | 'err';
  threadId?: string;
  startTime?: number;
  duration?: number;
  error?: string;
  result?: State;

  // Ok this changes quite a bit huh
  plan: ExecutionPlan; // this doesn't include options
  input: State;
};

export type CallWorker = (
  task: string,
  args: any[],
  events?: any,
  options?: Omit<ExecOpts, 'on'>
) => Promise<any>;

export type ExecutionContextConstructor = {
  state: WorkflowState;
  logger: Logger;
  callWorker: CallWorker;
  options: ExecutionContextOptions;
};

export type ExecuteOptions = {
  payloadLimitMb?: number;
  logPayloadLimitMb?: number;
  memoryLimitMb?: number;
  resolvers?: LazyResolvers;
  runTimeoutMs?: number;
  sanitize?: SanitizePolicies;
  jobLogLevel?: string;
};

export type ExecutionContextOptions = ExecuteOptions & EngineOptions;

export interface EngineAPI extends EventEmitter {
  callWorker: CallWorker;
  closeWorkers: (instant?: boolean) => Promise<void>;
}

export interface RuntimeEngine {
  version?: string;

  options: EngineOptions;

  // TODO should return an unsubscribe hook
  listen(runId: UUID, listeners: any): void;

  execute(
    plan: ExecutionPlan,
    input: State,
    options?: Partial<EngineOptions>
  ): Pick<EventEmitter, 'on' | 'off' | 'once'>;

  destroy(instant?: boolean): Promise<void>;

  on: (evt: string, fn: (...args: any[]) => void) => void;
}

export type Versions = {
  node: string;
  engine: string;
  compiler: string;
  runtime: string;

  [adaptor: string]: string | string[];
};
