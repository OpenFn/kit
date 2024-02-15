import Koa from 'koa';
import type {
  LightningPlan,
  DataClip,
  Credential,
} from '@openfn/lexicon/lightning';
import type { ServerState } from './server';

export type LightningEvents = 'log' | 'run-complete';

export type DevServer = Koa & {
  state: ServerState;
  addCredential(id: string, cred: Credential): void;
  addDataclip(id: string, data: DataClip): void;
  enqueueRun(run: LightningPlan): void;
  destroy: () => void;
  getRun(id: string): LightningPlan;
  getCredential(id: string): Credential;
  getDataclip(id: string): DataClip;
  getQueueLength(): number;
  getResult(runId: string): any;
  getState(): ServerState;
  on(event: LightningEvents, fn: (evt: any) => void): void;
  once(event: LightningEvents, fn: (evt: any) => void): void;
  onSocketEvent(
    event: LightningEvents,
    runId: string,
    fn: (evt: any) => void
  ): void;
  registerRun(run: LightningPlan): void;
  removeAllListeners(): void;
  reset(): void;
  startRun(id: string): any;
  waitForResult(runId: string): Promise<any>;
};
