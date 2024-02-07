import { SanitizePolicies } from '@openfn/logger';
import type { Channel as PhxChannel } from 'phoenix';
import type { ExecutionPlan } from '@openfn/runtime';

export { Socket };

// Internal server state for each run
export type RunState = {
  activeStep?: string;
  activeJob?: string;
  plan: ExecutionPlan;
  options: RunOptions;
  dataclips: Record<string, any>;
  // For each run, map the input ids
  // TODO better name maybe?
  inputDataclips: Record<string, string>;
  reasons: Record<string, ExitReason>;

  // final dataclip id
  lastDataclipId?: string;
};

export type CancelablePromise = Promise<void> & {
  cancel: () => void;
};

type ReceiveHook = {
  receive: (
    status: 'ok' | 'timeout' | 'error',
    callback: (payload?: any) => void
  ) => ReceiveHook;
};

export interface Channel extends PhxChannel {
  // on: (event: string, fn: (evt: any) => void) => void;

  // TODO it would be super nice to infer the event from the payload
  push: <P = any>(event: string, payload?: P) => ReceiveHook;
  // join: () => ReceiveHook;
}

// override the JSON log typing because the log message
// might be JSON encoded in a string
export type JSONLog = Omit<JSONLog, 'message'> & {
  message: string | any[];
};
