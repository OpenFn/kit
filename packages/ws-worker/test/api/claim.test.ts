import test from 'ava';
import * as jose from 'jose';
import crypto from 'node:crypto';

import { verifyToken } from '../../src/api/claim';
import { generateKeys } from '@openfn/lightning-mock/src/util';

let keys = { public: '.', private: '.' };

test.before(async () => {
  keys = await generateKeys();
});

// Helper function to generate a token with custom iat and nbf offsets
const generateToken = async (
  runId: string,
  privateKey: string,
  iatOffset: number = 0,
  nbfOffset: number = 0,
  issuer: string = 'Lightning'
) => {
  const alg = 'RS256';
  const key = crypto.createPrivateKey(privateKey);
  const currentTime = Math.floor(Date.now() / 1000);

  const jwt = await new jose.SignJWT({ id: runId })
    .setProtectedHeader({ alg })
    .setIssuedAt(currentTime + iatOffset)
    .setNotBefore(currentTime + nbfOffset)
    .setIssuer(issuer)
    .setExpirationTime('2h')
    .sign(key);

  return jwt;
};

const assertTokenValid = async (t: any, token: string, message?: string) => {
  const result = await verifyToken(token, keys.public);
  t.true(result);
  if (message) {
    t.log(message);
  }
};

const assertTokenInvalid = async (t: any, token: string) => {
  await t.throwsAsync(() => verifyToken(token, keys.public), {
    instanceOf: Error,
  });
};

// Test cases for token verification with different offsets
const toleranceTestCases = [
  {
    name: 'should accept a token that is 2 seconds in the past',
    iatOffset: -2,
    nbfOffset: -2,
    assertion: assertTokenValid,
  },
  {
    name: 'should accept a token that is 2 seconds in the future',
    iatOffset: 2,
    nbfOffset: 2,
    assertion: assertTokenValid,
  },
  {
    name: 'should accept a token with NBF 4 seconds in future (within tolerance)',
    nbfOffset: 4,
    assertion: assertTokenValid,
  },
  {
    name: 'should reject a token with NBF 6 seconds in future (beyond tolerance)',
    nbfOffset: 6,
    assertion: assertTokenInvalid,
  },
  {
    name: 'should accept a current token (0 seconds offset)',
    nbfOffset: 0,
    assertion: assertTokenValid,
  },
];

// Generate tolerance tests
toleranceTestCases.forEach(({ name, iatOffset, nbfOffset, assertion }) => {
  test(`verifyToken ${name}`, async (t) => {
    const token = await generateToken(
      'test-run',
      keys.private,
      iatOffset,
      nbfOffset
    );
    await assertion(t, token);
  });
});

// Edge case tests
test('verifyToken should reject a token that is 10 seconds in the past', async (t) => {
  const token = await generateToken('test-run', keys.private, 0, -10);
  await assertTokenValid(t, token);
});

test('verifyToken should reject token with wrong issuer', async (t) => {
  const token = await generateToken(
    'test-run',
    keys.private,
    0,
    0,
    'WrongIssuer'
  );
  await assertTokenInvalid(t, token);
});

test('verifyToken should accept a token with NBF exactly 2 seconds in future (user requirement)', async (t) => {
  const token = await generateToken('test-run', keys.private, 0, 2);
  await assertTokenValid(
    t,
    token,
    '✅ Token that is 2 seconds off is accepted within 5-second clock tolerance'
  );
});
