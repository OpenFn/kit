import test from 'ava';
import ensurePayloadSize from '../../src/util/ensure-payload-size';

const mb = (bytes: number) => bytes / 1024 / 1024;

test('throw limit 0, payload 1 byte', (t) => {
  t.throws(() => ensurePayloadSize('x', 0), {
    name: 'PAYLOAD_TOO_LARGE',
  });
});

test('ok for limit 1byte, payload 1 byte', (t) => {
  t.notThrows(() => ensurePayloadSize('x', mb(1)));
});

test('throw for limit 1byte, payload 2 bytes', (t) => {
  t.throws(() => ensurePayloadSize('xy', mb(1)), {
    name: 'PAYLOAD_TOO_LARGE',
  });
});

test('ok for short string, limit 1mb', (t) => {
  t.notThrows(() => ensurePayloadSize('hello world', 1));
});

test('ok for 1mb string, limit 1mb', (t) => {
  const str = new Array(1024 * 1024).fill('z').join('');
  t.notThrows(() => ensurePayloadSize(str, 1));
});

test('throw for 1mb string + 1 byte, limit 1mb', (t) => {
  const str = new Array(1024 * 1024 + 1).fill('z').join('');
  t.throws(() => ensurePayloadSize(str, 1), {
    name: 'PAYLOAD_TOO_LARGE',
  });
});

test('ok if no limit', (t) => {
  const str = new Array(1024 * 1024 + 1).fill('z').join('');
  t.notThrows(() => ensurePayloadSize(str));
});

test('error shape', (t) => {
  try {
    const str = new Array(1024 * 1024 + 1).fill('z').join('');
    ensurePayloadSize(str, 1);
  } catch (e: any) {
    t.is(e.severity, 'kill');
    t.is(e.name, 'PAYLOAD_TOO_LARGE');
    t.is(e.message, 'The payload exceeded the size limit of 1mb');
  }
});
