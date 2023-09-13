import WebSocket, { WebSocketServer } from 'ws';

const s = new WebSocket('ws://localhost:8080');
s.on('open', () => {
  console.log('sending...');
  s.send('hello');
  process.exit(0);
});
