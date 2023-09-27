import test from 'ava';
import { mockSocket, mockChannel } from '../../src/mock/sockets';

test('mock channel: join', (t) => {
  return new Promise((done) => {
    const channel = mockChannel();
    t.assert(channel.hasOwnProperty('push'));
    t.assert(channel.hasOwnProperty('join'));

    channel.join().receive('ok', () => {
      t.pass();
      done();
    });
  });
});

test('mock channel: should invoke handler with payload', (t) => {
  return new Promise((done) => {
    const channel = mockChannel({
      ping: (evt) => {
        t.is(evt, 'abc');
        t.pass();
        done();
      },
    });

    channel.push('ping', 'abc');
  });
});

test('mock channel: invoke the ok handler with the callback result', (t) => {
  return new Promise((done) => {
    const channel = mockChannel({
      ping: () => {
        return 'pong!';
      },
    });

    channel.push('ping', 'abc').receive('ok', (evt) => {
      t.is(evt, 'pong!');
      t.pass();
      done();
    });
  });
});

test('mock channel: listen to event', (t) => {
  return new Promise((done) => {
    const channel = mockChannel();

    channel.on('ping', () => {
      t.pass();
      done();
    });

    channel.push('ping');
  });
});

test('mock socket: connect', (t) => {
  return new Promise((done) => {
    const socket = mockSocket();

    // this is a noop
    socket.connect();
    t.pass('connected');
    done();
  });
});

test('mock socket: connect to channel', (t) => {
  return new Promise((done) => {
    const socket = mockSocket();

    const channel = socket.channel('abc');
    t.assert(channel.hasOwnProperty('push'));
    t.assert(channel.hasOwnProperty('join'));

    channel.join().receive('ok', () => {
      t.pass();
      done();
    });
  });
});
