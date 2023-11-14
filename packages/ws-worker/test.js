import { Socket } from 'phoenix';
import { WebSocket } from 'ws';

const socket = new Socket('http://localhost:4000/worker', {
  transport: WebSocket,
});

socket.onOpen(() => {
  console.log('OPEN');
});

socket.onError((e) => {
  console.log('ERROR');
  console.log(e);
});

socket.connect();
