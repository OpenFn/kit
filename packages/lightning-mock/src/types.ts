import Koa from 'koa';
import type { ServerState } from './server';

export type Node = {
  id: string;
  body?: string;
  adaptor?: string;
  credential?: any; // TODO tighten this up, string or object
  type?: 'webhook' | 'cron'; // trigger only
  state?: any; // Initial state / defaults
};

export interface Edge {
  id: string;
  source_job_id?: string;
  source_trigger_id?: string;
  target_job_id: string;
  name?: string;
  condition?: string;
  error_path?: boolean;
  errors?: any;
}

// An attempt object returned by Lightning
export type Attempt = {
  id: string;
  dataclip_id: string;
  starting_node_id: string;

  triggers: Node[];
  jobs: Node[];
  edges: Edge[];

  options?: Record<string, any>; // TODO type the expected options
};

export type LightningEvents = 'log' | 'attempt-complete';

export type DataClip = any;

export type DevServer = Koa & {
  state: ServerState;
  addCredential(id: string, cred: Credential): void;
  addDataclip(id: string, data: DataClip): void;
  enqueueAttempt(attempt: Attempt): void;
  destroy: () => void;
  getAttempt(id: string): Attempt;
  getCredential(id: string): Credential;
  getDataclip(id: string): DataClip;
  getQueueLength(): number;
  getResult(attemptId: string): any;
  getState(): ServerState;
  on(event: LightningEvents, fn: (evt: any) => void): void;
  once(event: LightningEvents, fn: (evt: any) => void): void;
  onSocketEvent(
    event: LightningEvents,
    attemptId: string,
    fn: (evt: any) => void
  ): void;
  registerAttempt(attempt: Attempt): void;
  reset(): void;
  startAttempt(id: string): any;
  waitForResult(attemptId: string): Promise<any>;
};
