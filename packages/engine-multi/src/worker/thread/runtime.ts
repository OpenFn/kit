// this is the core runtime for inside the thread
import { parentPort } from 'node:worker_threads';
import {
  ENGINE_REJECT_TASK,
  ENGINE_RESOLVE_TASK,
  ENGINE_RUN_TASK,
} from '../events';

type TaskRegistry = Record<string, (...args: any[]) => Promise<any>>;

export const threadId = process.pid;

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
  [key: string]: any;
};

// TODO can't really be a promise any more unless I implement an acknowledgement

// payload: Omit<workerEvents.EventMap[T], 'type' | 'workflowId' | 'threadId'>

export const publish = (
  type: string,
  payload: Omit<Event, 'threadId' | 'type'>
) =>
  parentPort.postMessage({
    type,
    threadId,
    ...payload,
  });
// export const publish = (evt) =>
//   new Promise((resolve) => {
//     process.postMessage(evt, undefined, {}, () => {
//       resolve();
//     });
//   });

const run = (task, args) => {
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

parentPort.on('message', async (evt) => {
  if (evt.type === ENGINE_RUN_TASK) {
    const args = evt.args || [];
    run(evt.task, args);
  }
});
