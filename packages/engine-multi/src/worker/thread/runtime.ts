// this is the core runtime for inside the thread
import { parentPort, threadId } from 'node:worker_threads';
import {
  ENGINE_REJECT_TASK,
  ENGINE_RESOLVE_TASK,
  ENGINE_RUN_TASK,
} from '../events';
import stringify from 'fast-safe-stringify';

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

export const publish = (
  type: string,
  payload: Omit<Event, 'threadId' | 'type'>
) => {
  parentPort!.postMessage({
    type,
    threadId,
    processId,
    // ensure the event message is serializable
    ...JSON.parse(stringify(payload)),
  });
};

const run = (task: string, args: any[]) => {
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
          type: e.type || e.name,
        },
      });
    });
};

parentPort!.on('message', async (evt) => {
  if (evt.type === ENGINE_RUN_TASK) {
    const args = evt.args || [];
    run(evt.task, args);
  }
});
