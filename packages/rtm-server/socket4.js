// This attempt builds my own websocket into koa, only available at one path
// Then I can use the connection handler myself to plug in my phoenix mock

import Koa from 'koa';
import Router from '@koa/router';
import Socket, { WebSocketServer } from 'ws';

const app = new Koa();

const server = app.listen(3333);

app.use((ctx) => {
  ctx.res;
  ponse.status = 200;
  return;
});

const r = new Router();
r.all('/', () => {});
app.use(r.routes());

const wss = new WebSocketServer({
  server,
  path: '/jam',
});

wss.on('connection', (socket, req) => {
  console.log('>> connection');
  socket.on('message', (m) => {
    console.log(m);
    const x = m.toString();
    if (x === 'ping') {
      console.log('received');
      socket.send('pong');
    }
  });
});

const s = new Socket('ws://localhost:3333/jam');

s.on('open', () => {
  console.log('pinging...');
  s.send('ping');
});

s.on('message', (m) => {
  const message = m.toString();
  if (message === 'pong') {
    console.log('pong!');
    process.exit(0);
  }
});
