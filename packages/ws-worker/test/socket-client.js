// this is a standalone test script
// run from the commandline ie `node test/socket-client.js`
import phx from 'phoenix-channels';

const endpoint = 'ws://localhost:8888/worker';

console.log('connecting to socket at ', endpoint);
const socket = new phx.Socket(endpoint);

socket.onOpen(() => {
  console.log('socket open!');

  const channel = socket.channel('worker:queue');
  channel.join().receive('ok', () => {
    console.log('connected to attempts queue');

    channel.on('pong', () => {
      console.log('received pong!');
    });

    channel.push('ping');
  });

  setInterval(() => {
    console.log('requesting work...');
    channel.push('attempts:claim');
  }, 500);
});

socket.connect();
