// create a koa ws server
import Koa from 'koa';
import route from 'koa-route';
import websockify from 'koa-websocket';
import Socket from 'ws';

// learnings: route is .all(path, fn)
// socket takes on 'message'

const app = websockify(new Koa());

console.log(app.ws);

app.ws.server.on('connection', () => {
  console.log(' >> connect');
});

// Regular middleware
// Note it's app.ws.use and not app.use
app.ws.use(
  route.all('/jam', (ctx, next) => {
    console.log('>> jam');

    // I need this connection from the server, not the socket
    // koa-ws hides that from me

    ctx.websocket.on('message', (m) => {
      const x = m.toString();
      if (x === 'ping') {
        console.log('received');
        ctx.websocket.send('pong');
      }
    });

    // return `next` to pass the context (ctx) on to the next ws middleware
    return next(ctx);
  })
);

// // Using routes
// app.ws.use(route.all('/test/:id', function (ctx) {
//   // `ctx` is the regular koa context created from the `ws` onConnection `socket.upgradeReq` object.
//   // the websocket is added to the context on `ctx.websocket`.
//   ctx.websocket.send('Hello World');
//   ctx.websocket.on('message', function(message) {
//     // do something with the message from client
//         console.log(message);
//   });
// }));

app.listen(3333);

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
