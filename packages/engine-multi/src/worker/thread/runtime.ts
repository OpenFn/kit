// this is the core runtime for inside the thread
import { parentPort } from 'node:worker_threads';
import {
  ENGINE_REJECT_TASK,
  ENGINE_RESOLVE_TASK,
  ENGINE_RUN_TASK,
} from '../events';

export const HANDLED_EXIT_CODE = 111111;

type TaskRegistry = Record<string, (...args: any[]) => Promise<any>>;

export const threadId = process.pid;

const tasks: TaskRegistry = {
  // startup validation script
  handshake: async () => true,
};

export const register = (newTasks: TaskRegistry) => {
  Object.assign(tasks, newTasks);
};

// TODO can't really be a promise any more unless I implement an acknowledgement
export const publish = (evt) => parentPort.postMessage(evt);
// export const publish = (evt) =>
//   new Promise((resolve) => {
//     process.postMessage(evt, undefined, {}, () => {
//       resolve();
//     });
//   });

const run = (task, args) => {
  tasks[task](...args)
    .then((result) => {
      publish({
        type: ENGINE_RESOLVE_TASK,
        result,
      });
    })
    .catch((e) => {
      publish({
        type: ENGINE_REJECT_TASK,
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
