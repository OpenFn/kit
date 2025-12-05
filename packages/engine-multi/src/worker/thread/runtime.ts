// this is the core runtime for inside the thread
import { parentPort, threadId } from 'node:worker_threads';
import {
  ENGINE_REJECT_TASK,
  ENGINE_RESOLVE_TASK,
  ENGINE_RUN_TASK,
  type WorkerEvents,
} from '../events';
import ensurePayloadSize from '../../util/ensure-payload-size';

// This constrains the size of any payloads coming out of the worker thread
// Payloads exceeding this will be redacted
// (in practice I think this is specifically the state and message keys)
export type PayloadLimits = {
  default?: number;
  [key: string]: number | undefined;
} & Partial<Record<WorkerEvents, number>>;

let payloadLimits: PayloadLimits | undefined;

type TaskRegistry = Record<string, (...args: any[]) => Promise<any>>;

export const processId = process.pid;

export { threadId } from 'node:worker_threads';

const tasks: TaskRegistry = {
  // startup validation script
  handshake: async () => {
    return true;
  },
};

export const register = (newTasks: TaskRegistry) => {
  Object.assign(tasks, newTasks);
};

type Event = {
  type: string;
  threadId: number;
  processId: number;
  [key: string]: any;
};

type Options = {
  memoryLimitMb?: number;
  payloadLimits?: PayloadLimits;
};

export const publish = (
  type: string,
  payload: Omit<Event, 'threadId' | 'type'>
) => {
  // Validate the size of every outgoing message
  // Redact any payloads that are too large
  // Use event-specific limit if available, otherwise use default
  const limit =
    payloadLimits?.[type as keyof PayloadLimits] ?? payloadLimits?.default;
  const safePayload = ensurePayloadSize(payload, limit);
  const x = {
    type,
    threadId,
    processId,
    ...safePayload,
  };
  parentPort!.postMessage(x);
};

const run = (task: string, args: any[], options: Options = {}) => {
  payloadLimits = options.payloadLimits;
  tasks[task](...args)
    .then((result) => {
      publish(ENGINE_RESOLVE_TASK, {
        result,
      });
    })
    .catch((e) => {
      publish(ENGINE_REJECT_TASK, {
        error: {
          severity: e.severity || 'crash',
          message: e.message,
          type: e.type,
          name: e.name,
        },
      });
    })
    .finally(() => {
      payloadLimits = undefined;
    });
};

process.on('exit', (code) => {
  publish(ENGINE_REJECT_TASK, {
    error: {
      name: 'ExitError',
      message: `Worker thread exited with code: ${code}`,
      severity: 'crash',
    },
  });
});

parentPort!.on('message', async (evt) => {
  if (evt.type === ENGINE_RUN_TASK) {
    const args = evt.args || [];
    run(evt.task, args, evt.options);
  }
});
