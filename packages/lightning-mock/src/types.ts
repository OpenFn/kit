import Koa from 'koa';
import type {
  LightningPlan,
  DataClip,
  Credential,
  Provisioner,
} from '@openfn/lexicon/lightning';
import type { ServerState } from './server';
import { PhoenixEvent } from './socket-server';

export type LightningEvents = 'log' | 'run-complete' | string; // not complete!

export type DevServer = Koa & {
  state: ServerState;
  addCredential(id: string, cred: Credential): void;
  addDataclip(id: string, data: DataClip): void;
  addProject(proj: Provisioner.Project_v1): void;
  enqueueRun(run: LightningPlan): void;
  destroy: () => Promise<void>;
  getRun(id: string): LightningPlan;
  getCredential(id: string): Credential;
  getDataclip(id: string): DataClip;
  getQueueLength(): number;
  getResult(runId: string): any;
  getState(): ServerState;
  messageSocketClients(message: PhoenixEvent): void;
  on(event: LightningEvents, fn: (evt: any) => void): void;
  once(event: LightningEvents, fn: (evt: any) => void): void;
  onSocketEvent(
    event: LightningEvents,
    runId: string,
    fn: (evt: any) => void,
    once?: boolean
  ): () => void;
  registerRun(run: LightningPlan): void;
  removeAllListeners(): void;
  reset(): void;
  startRun(id: string): any;
  waitForResult(runId: string): Promise<any>;

  /** Collections API (from the adaptor) */
  collections: any;
};
