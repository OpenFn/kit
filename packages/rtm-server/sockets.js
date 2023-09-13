import WebSocket, { WebSocketServer } from 'ws';
import phx from 'phoenix-channels';
import http from 'node:http';

const { Socket } = phx;

/*
 * web socket experiments
 */

/*
 Super simple ws implementation
*/
const wsServer = new WebSocketServer({
  port: 8080,
});

wsServer.on('connection', function (ws) {
  console.log('connection');

  ws.on('message', function (data) {
    console.log('server received: %s', data);

    // TMP
    // process.exit(0);
  });
});

// const s = new WebSocket('ws://localhost:8080');

// // This bit is super important! Can't send ontil we've got the on open callback
// s.on('open', () => {
//   console.log('sending...');
//   s.send('hello');
// });

// This is a phoenix socket backing onto a normal websocket server
const s = new Socket('ws://localhost:8080');
s.connect();

console.log('*');
let channel = s.channel('room:lobby', {});
channel.join().receive('ok', (resp) => {
  console.log('Joined successfully', resp);

  channel.push('hello');
});
//   .receive('error', (resp) => {
//     console.log('Unable to join', resp);
//   });

// channel.push('hello');
