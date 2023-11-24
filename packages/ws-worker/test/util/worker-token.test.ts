import test from 'ava';
import * as jose from 'jose';

import generateWorkerToken from '../../src/util/worker-token';
import { createMockLogger } from '@openfn/logger';

const logger = createMockLogger();

test('should generate a worker token as a JWT', async (t) => {
  const jwt = await generateWorkerToken('abc', 'x', logger);

  t.truthy(jwt);
  t.assert(typeof jwt === 'string');

  const parts = jwt.split('.');
  t.is(parts.length, 3);
});

test('should verify the signature', async (t) => {
  const secret = 'abc';
  const encodedSecret = new TextEncoder().encode(secret);

  const jwt = await generateWorkerToken(secret, 'x', logger);

  const { payload, protectedHeader } = await jose.jwtVerify(jwt, encodedSecret);

  t.is(payload.worker_id, 'x');
  t.deepEqual(protectedHeader, { alg: 'HS256' });
});

test('should throw on verify if the signature is wrong', async (t) => {
  const secret = 'abc';
  const encodedSecret = new TextEncoder().encode('xyz');

  const jwt = await generateWorkerToken(secret, 'x', logger);

  await t.throwsAsync(() => jose.jwtVerify(jwt, encodedSecret));
});

test('should include the server id in the payload', async (t) => {
  const jwt = await generateWorkerToken('abc', 'x', logger);
  const claims = jose.decodeJwt(jwt);

  t.is(claims.worker_id, 'x');
});
