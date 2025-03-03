// this is the child process runtime environment
// it lists to run calls, spins up a thread, and forwards events
import type { WorkerEvent } from '../../api/call-worker';
import { OOMError } from '../../errors';
import {
  ENGINE_REJECT_TASK,
  ENGINE_RESOLVE_TASK,
  ENGINE_RUN_TASK,
} from '../events';
import createThread from './create-thread';
import serializeError from '../../util/serialize-error';

// use websockets to stream data between processes
// import { WebSocketServer, WebSocket } from 'ws';
// const socket = new WebSocket(url);

// // TODO how to safely get a port?
// // Scan and find one?
// // Take one as an argument?
// const wss = new WebSocketServer({ port: 3366 });

// let socket: any;

process.on('message', async (evt: WorkerEvent, _handle) => {
  // console.log(' >>>>>', evt);
  // if (evt === 'socket') {
  //   console.log('@@@@@@@@ ASSIGNING SOCKET ');
  //   socket = _handle;
  // } else

  if (evt.type === ENGINE_RUN_TASK) {
    const { args, options } = evt;
    run(evt.task, args, options);
  }
});

const run = async (
  task: string,
  args: any[] = [],
  options = {},
  socket: any
) => {
  const thread = createThread(task, args, options);

  thread.on('error', (e) => {
    // @ts-ignore
    if (e.code === 'ERR_WORKER_OUT_OF_MEMORY') {
      e = new OOMError();

      process.send!({
        type: ENGINE_REJECT_TASK,
        error: serializeError(e),
      });
    }
  });

  thread.on('message', (evt) => {
    console.log('!!!!!!!!!!!', evt.type);
    process.send!(evt, socket);

    if (evt.type === ENGINE_RESOLVE_TASK || evt.type === ENGINE_REJECT_TASK) {
      // TODO wait for this to finish (or throw)
      // then destroy the thread
      thread.terminate();
    }
  });
};
