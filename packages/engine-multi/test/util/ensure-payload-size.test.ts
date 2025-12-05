import test from 'ava';
import ensurePayloadSize, {
  verify,
  calculateSizeStringify,
  calculateSizeStream,
} from '../../src/util/ensure-payload-size';

(['stringify', 'stream'] as const).forEach((algo) => {
  test(algo + ': throw limit 0, payload 1 byte', async (t) => {
    await t.throwsAsync(() => verify('x', 0, algo), {
      name: 'PAYLOAD_TOO_LARGE',
    });
  });

  test(algo + ': ok for limit 1byte, payload 1 byte', async (t) => {
    await t.notThrowsAsync(() => verify(1, 1 / 1024 / 1024, algo));
  });

  test(algo + ': throw for limit 1byte, payload 2 bytes', async (t) => {
    await t.throwsAsync(() => verify(12, 1 / 1024 / 1024, algo), {
      name: 'PAYLOAD_TOO_LARGE',
    });
  });

  test(algo + ': ok for short string, limit 1mb', async (t) => {
    await t.notThrowsAsync(() => verify('hello world', 1, algo));
  });

  test(algo + ': ok for 1mb string, limit 1mb', async (t) => {
    const str = parseInt(new Array(1024 * 1024).fill(1).join(''));
    await t.notThrowsAsync(() => verify(str, 1, algo));
  });

  test(algo + ': throw for 1mb string + 1 byte, limit 1mb', async (t) => {
    const str = new Array(1024 * 1024 + 1).fill('z').join('');
    await t.throwsAsync(() => verify(str, 1, algo), {
      name: 'PAYLOAD_TOO_LARGE',
    });
  });

  test(algo + ': ok if no limit', async (t) => {
    const str = new Array(1024 * 1024 + 1).fill('z').join('');
    await t.notThrowsAsync(() => verify(str));
  });

  test(algo + ': error shape', async (t) => {
    try {
      const str = new Array(1024 * 1024 + 1).fill('z').join('');
      await verify(str, 1);
    } catch (e: any) {
      t.is(e.name, 'PAYLOAD_TOO_LARGE');
      t.is(e.message, 'The payload exceeded the size limit of 1mb');
    }
  });

  test(algo + ': redact payload with state', async (t) => {
    const payload = {
      state: {
        data: new Array(1024 * 1024).fill('z').join(''),
      },
    };

    const newPayload = await ensurePayloadSize(payload, 1);
    t.deepEqual(newPayload.state, {
      data: '[REDACTED]',
    });
    t.true(newPayload.redacted);
  });

  test(algo + ': redact payload with log message', async (t) => {
    const payload = {
      log: {
        message: [new Array(1024 * 1024).fill('z').join('')],
      },
    };

    const newPayload = await ensurePayloadSize(payload, 1);
    t.deepEqual(newPayload.log, {
      message: ['[REDACTED: Message length exceeds payload limit]'],
    });
    t.true(newPayload.redacted);
  });

  test(algo + ': redact payload with final_state', async (t) => {
    const payload = {
      final_state: {
        data: new Array(1024 * 1024).fill('z').join(''),
      },
    };

    const newPayload = await ensurePayloadSize(payload, 1);
    t.deepEqual(newPayload.final_state, {
      data: '[REDACTED]',
    });
    t.true(newPayload.redacted);
  });
});

test('size estimation: null value', async (t) => {
  const value = { x: null };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: undefined value', async (t) => {
  const value = { x: undefined };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: string value', async (t) => {
  const value = { x: 'hello world' };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: number value', async (t) => {
  const value = { x: 42 };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: negative number', async (t) => {
  const value = { x: -123.456 };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: boolean true', async (t) => {
  const value = { x: true };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: boolean false', async (t) => {
  const value = { x: false };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: empty object', async (t) => {
  const value = { x: {} };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: empty array', async (t) => {
  const value = { x: [] };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: simple object with mixed types', async (t) => {
  const value = {
    name: 'test',
    age: 25,
    active: true,
    nullable: null,
  };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: simple array with mixed types', async (t) => {
  const value = { x: ['hello', 42, true, null, false] };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: object with string exceeding limit', async (t) => {
  const value = {
    data: new Array(1024 * 1024).fill('z').join(''),
  };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: array of strings within limit', async (t) => {
  const value = { x: ['a', 'b', 'c', 'd', 'e'] };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: nested object structure', async (t) => {
  const value = {
    user: {
      name: 'John Doe',
      address: {
        street: '123 Main St',
        city: 'Springfield',
        coordinates: {
          lat: 42.1234,
          lng: -71.5678,
        },
      },
      settings: {
        notifications: true,
        theme: 'dark',
      },
    },
  };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: nested arrays and objects', async (t) => {
  const value = {
    data: [
      { id: 1, tags: ['a', 'b', 'c'] },
      { id: 2, tags: ['d', 'e', 'f'] },
      {
        id: 3,
        nested: {
          deep: {
            values: [1, 2, 3, 4, 5],
          },
        },
      },
    ],
  };
  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});

test('size estimation: deeply nested object', async (t) => {
  let value: any = { data: 'leaf' };
  for (let i = 0; i < 100; i++) {
    value = { level: i, child: value };
  }

  const sizeStringify = calculateSizeStringify(value);
  const sizeStream = await calculateSizeStream(value);
  t.is(sizeStream, sizeStringify);
});
