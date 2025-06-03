import test from 'ava';
import * as jose from 'jose';
import crypto from 'node:crypto';

import { generateRunToken } from '../src/tokens';
import { generateKeys } from '../src/util';

let keys = { public: '.', private: '.' };

// util function to verify a token against a public key
const verify = async (token: string, publicKey: string) => {
  const key = crypto.createPublicKey(publicKey);

  const { payload } = await jose.jwtVerify(token, key);

  return payload;
};

test.before(async () => {
  keys = await generateKeys();
});

test('generate a placeholder token if no key passed', async (t) => {
  const result = await generateRunToken('.');
  t.is(result, 'x.y.z');
});

test('generate a real token if a key is passed', async (t) => {
  const result = await generateRunToken('.', keys.private);
  t.true(result.length > 100);
});

test('token should be verified with the public key', async (t) => {
  const result = await generateRunToken('.', keys.private);

  // Basically testing that this doesn't throw
  const payload = await verify(result, keys.public);
  t.log(payload);
  t.truthy(payload);
});

test('token claims should include the run id', async (t) => {
  const result = await generateRunToken('23', keys.private);

  const { id } = await verify(result, keys.public);
  t.is(id, '23');
});

test('token claims should include the issuer: Lightning', async (t) => {
  const result = await generateRunToken('23', keys.private);

  const { iss } = await verify(result, keys.public);
  t.is(iss, 'Lightning');
});

test('token claims should include NBF (not before)', async (t) => {
  const beforeGeneration = Math.floor(Date.now() / 1000);
  const result = await generateRunToken('23', keys.private);
  const afterGeneration = Math.floor(Date.now() / 1000);

  const payload = await verify(result, keys.public);
  const nbf = payload.nbf as number;

  t.truthy(nbf);
  t.true(typeof nbf === 'number');
  t.true(nbf >= beforeGeneration);
  t.true(nbf <= afterGeneration);
});

// TODO - claim should include exp and nbf
