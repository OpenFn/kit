import test from 'ava';
import ensurePayloadSize, { verify } from '../../src/util/ensure-payload-size';

const mb = (bytes: number) => bytes / 1024 / 1024;

test('throw limit 0, payload 1 byte', (t) => {
  t.throws(() => verify('x', 0), {
    name: 'PAYLOAD_TOO_LARGE',
  });
});

test('ok for limit 1byte, payload 1 byte', (t) => {
  t.notThrows(() => verify('x', mb(1)));
});

test('throw for limit 1byte, payload 2 bytes', (t) => {
  t.throws(() => verify('xy', mb(1)), {
    name: 'PAYLOAD_TOO_LARGE',
  });
});

test('ok for short string, limit 1mb', (t) => {
  t.notThrows(() => verify('hello world', 1));
});

test('ok for 1mb string, limit 1mb', (t) => {
  const str = new Array(1024 * 1024).fill('z').join('');
  t.notThrows(() => verify(str, 1));
});

test('throw for 1mb string + 1 byte, limit 1mb', (t) => {
  const str = new Array(1024 * 1024 + 1).fill('z').join('');
  t.throws(() => verify(str, 1), {
    name: 'PAYLOAD_TOO_LARGE',
  });
});

test('ok if no limit', (t) => {
  const str = new Array(1024 * 1024 + 1).fill('z').join('');
  t.notThrows(() => verify(str));
});

test('error shape', (t) => {
  try {
    const str = new Array(1024 * 1024 + 1).fill('z').join('');
    verify(str, 1);
  } catch (e: any) {
    t.is(e.name, 'PAYLOAD_TOO_LARGE');
    t.is(e.message, 'The payload exceeded the size limit of 1mb');
  }
});

test('redact payload with state', (t) => {
  const payload = {
    state: {
      data: new Array(1024 * 1024).fill('z').join(''),
    },
  };

  const newPayload = ensurePayloadSize(payload, 1);
  t.deepEqual(newPayload.state, {
    data: '[REDACTED]',
  });
  t.true(newPayload.redacted);
});

test('redact payload with log message', (t) => {
  const payload = {
    log: {
      message: [new Array(1024 * 1024).fill('z').join('')],
    },
  };

  const newPayload = ensurePayloadSize(payload, 1);
  t.deepEqual(newPayload.log, {
    message: ['[REDACTED: Message length exceeds payload limit]'],
  });
  t.true(newPayload.redacted);
});

test('redact payload with final_state', (t) => {
  const payload = {
    final_state: {
      data: new Array(1024 * 1024).fill('z').join(''),
    },
  };

  const newPayload = ensurePayloadSize(payload, 1);
  t.deepEqual(newPayload.final_state, {
    data: '[REDACTED]',
  });
  t.true(newPayload.redacted);
});
