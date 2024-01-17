// this is the child process runtime environment
// it lists to run calls, spins up a thread, and forwards events
import type { WorkerEvent } from '../../api/call-worker';
import {
  ENGINE_REJECT_TASK,
  ENGINE_RESOLVE_TASK,
  ENGINE_RUN_TASK,
} from '../events';
import createThread from './create-thread';

process.on('message', async (evt: WorkerEvent) => {
  if (evt.type === ENGINE_RUN_TASK) {
    const args = evt.args || [];
    run(evt.task, args);
  }
});

const run = async (task: string, args: any[]) => {
  const thread = createThread();

  thread.on('message', (evt) => {
    process.send(evt);

    if (evt.type === ENGINE_RESOLVE_TASK || evt.type === ENGINE_REJECT_TASK) {
      // TODO wait for this to finsih (or throw)
      // then destroy the thread
      thread.terminate();
    }
  });

  thread.run(task, args);
};
