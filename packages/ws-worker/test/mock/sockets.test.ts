import test from 'ava';
import { MockSocket, mockChannel } from '../../src/mock/sockets';

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

test('mock channel: join with mock handler', (t) => {
  return new Promise((done) => {
    const channel = mockChannel({
      join: () => ({ status: 'ok' }),
    });

    t.assert(channel.hasOwnProperty('push'));
    t.assert(channel.hasOwnProperty('join'));

    channel.join().receive('ok', () => {
      t.pass();
      done();
    });
  });
});

test('mock channel: error on join', (t) => {
  return new Promise((done) => {
    const channel = mockChannel({
      join: () => ({ status: 'error', response: 'fail' }),
    });

    t.assert(channel.hasOwnProperty('push'));
    t.assert(channel.hasOwnProperty('join'));

    channel.join().receive('error', () => {
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

    channel.push('ping', 'abc').receive('ok', (evt: any) => {
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
    const socket = new MockSocket();

    socket.connect();
    t.pass('connected');
    done();
  });
});

test('mock socket: connect and call onOpen', (t) => {
  return new Promise((done) => {
    const socket = new MockSocket();

    socket.onOpen(() => {
      t.pass('called on open');
      done();
    });

    socket.connect();
  });
});

test('mock socket: call onOpen with customConnect', (t) => {
  return new Promise((done) => {
    let didCallConnect = false;

    const socket = new MockSocket('www', {}, async () => {
      didCallConnect = true;
    });

    socket.onOpen(() => {
      t.true(didCallConnect);
      done();
    });

    socket.connect();
  });
});

test('mock socket: call onError if connect throws', (t) => {
  return new Promise((done) => {
    const socket = new MockSocket('www', {}, async () => {
      throw 'err';
    });

    socket.onError((e) => {
      t.is(e, 'err');
      t.pass();
      done();
    });

    socket.connect();
  });
});

test('mock socket: connect to channel', (t) => {
  return new Promise((done) => {
    const socket = new MockSocket();

    const channel = socket.channel('abc');
    t.assert(channel.hasOwnProperty('push'));
    t.assert(channel.hasOwnProperty('join'));

    channel.join().receive('ok', () => {
      t.pass();
      done();
    });
  });
});
