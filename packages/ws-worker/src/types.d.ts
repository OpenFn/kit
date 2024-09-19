import { SanitizePolicies } from '@openfn/logger';
import type { ExecutionPlan, Lazy, State } from '@openfn/lexicon';
import type { Channel as PhxChannel } from 'phoenix';

export { Socket };

// Internal server state for each run
export type RunState = {
  activeStep?: string;
  activeJob?: string;
  plan: ExecutionPlan;
  input: Lazy<State>;
  dataclips: Record<string, any>;
  // For each run, map the input ids
  // TODO better name maybe?
  inputDataclips: Record<string, string>;
  // If for any reason a dataclip was not sent to lightning, track it
  withheldDataclips: Record<string, true>;
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
