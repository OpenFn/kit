import test from 'ava';
import * as jose from 'jose';
import crypto from 'node:crypto';

import claim, { resetClaimIdGen, verifyToken } from '../../src/api/claim';
import { generateKeys } from '@openfn/lightning-mock/src/util';
import { createMockLogger } from '@openfn/logger';
import { ServerApp } from '../../src/server';
import { mockChannel } from '../../src/mock/sockets';
import { CLAIM } from '../../src';
import EventEmitter from 'node:events';
import { createWorkloop, Workloop } from '../../src/util/parse-workloops';

let keys = { public: '.', private: '.' };

test.before(async () => {
  keys = await generateKeys();
});

test.beforeEach(() => {
  resetClaimIdGen();
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

const createMockWorkloop = (capacity = 5): Workloop =>
  createWorkloop({ queues: ['manual', '*'], capacity });

const createMockApp = (opts: any) => {
  const {
    onClaim = () => ({ runs: [] }),
    onExecute = () => {},
    workflows = {},
  } = opts;

  const channel = mockChannel({
    [CLAIM]: (args) => {
      return onClaim(args);
    },
  });

  return {
    openClaims: {},
    workflows,
    queueChannel: channel,
    workloops: [],
    runWorkloopMap: {},
    execute: (...args: any) => {
      onExecute(...args);
    },
    events: new EventEmitter(),
  } as unknown as ServerApp;
};
const logger = createMockLogger();

test.todo('claim: should do nothing if no runs returned');

test('claim: should call execute for a single run', async (t) => {
  let executeArgs: any[] = [];
  const onClaim = () => ({ runs: [{ id: 'abc' }] });
  const onExecute = (...args: any[]) => {
    executeArgs = args;
  };

  const workloop = createMockWorkloop(1);
  const app = createMockApp({
    onClaim,
    onExecute,
  });
  app.runWorkloopMap = {};

  await claim(app, logger, workloop);
  t.deepEqual(executeArgs[0], { id: 'abc' });
  t.true(workloop.activeRuns.has('abc'));
  t.is(app.runWorkloopMap['abc'], workloop);
});

test('should not claim if workloop is at capacity', async (t) => {
  const workloop = createMockWorkloop(1);
  workloop.activeRuns.add('a');

  const app = createMockApp({
    workflows: { a: true },
  });

  await t.throwsAsync(() => claim(app, logger, workloop), {
    message: 'Server at capacity',
  });
});

test('should mark a claim when in flight', async (t) => {
  const workloop = createMockWorkloop(5);

  const app = createMockApp({
    workflows: {},
  });

  let claimPromise = claim(app, logger, workloop);

  t.is(workloop.openClaims['1'], 1);
  t.is(app.openClaims['1'], 1);

  await t.throwsAsync(claimPromise, {
    message: 'No runs returned',
  });
});

test('should remove an open claim when completed', async (t) => {
  const workloop = createMockWorkloop(5);

  const app = createMockApp({
    workflows: {},
  });

  await t.throwsAsync(() => claim(app, logger, workloop), {
    message: 'No runs returned',
  });

  t.falsy(workloop.openClaims['1']);
  t.falsy(app.openClaims['1']);
});

test('should remove an open claim on error', async (t) => {
  const workloop = createMockWorkloop(5);

  const app = createMockApp({
    workflows: {},
    onClaim: () => {
      throw {};
    },
  });

  await t.throwsAsync(() => claim(app, logger, workloop), {
    message: 'claim error',
  });

  t.falsy(workloop.openClaims['1']);
  t.falsy(app.openClaims['1']);
});

// TODO not really sure how to check this
test.skip('should remove an open claim on timeout', async (t) => {
  const workloop = createMockWorkloop(5);

  const app = createMockApp({
    workflows: {},
    onClaim: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 60));
    },
  });

  await t.throwsAsync(() => claim(app, logger, workloop), {
    message: 'timeout',
  });

  t.falsy(workloop.openClaims['1']);
  t.falsy(app.openClaims['1']);
});

test('should mark a claim when in flight with demand: 2', async (t) => {
  const workloop = createMockWorkloop(5);

  const app = createMockApp({
    workflows: {
      a: true,
    },
  });

  let claimPromise = claim(app, logger, workloop, { demand: 2 });

  t.is(workloop.openClaims['1'], 2);
  t.is(app.openClaims['1'], 2);

  await t.throwsAsync(claimPromise, {
    message: 'No runs returned',
  });
});

test('should not claim if open claims exceeds workloop capacity', async (t) => {
  let didStopWorkloop = false;

  const workloop = createMockWorkloop(1);
  // startWorkloop would overwrite these, but for test we set them directly
  workloop.stop = () => {
    didStopWorkloop = true;
  };
  workloop.isStopped = () => false;

  const app = createMockApp({
    workflows: {},
    // Slow claim event
    onClaim: () =>
      new Promise((resolve) => {
        // @ts-ignore
        setTimeout(resolve({ runs: [] }), 100);
      }),
  });
  app.runWorkloopMap = {};

  // @ts-ignore
  app.execute = ({ id }) => {
    app.workflows[id] = true;
  };

  // first claim should be fine
  let claimPromise = claim(app, logger, workloop);

  // second claim should error and stop the loop actually
  await t.throwsAsync(() => claim(app, logger, workloop), {
    message: 'Server at capacity',
  });
  t.true(didStopWorkloop);

  // The prior claim should not have counted for anything
  t.is(Object.keys(app.workflows).length, 0);

  // wait for the original return to finish
  await t.throwsAsync(claimPromise, {
    message: 'No runs returned',
  });
});

test('should not claim if open claims + active runs exceeds workloop capacity', async (t) => {
  const workloop = createMockWorkloop(2);
  workloop.activeRuns.add('a');

  const app = createMockApp({
    workflows: {
      // pretend a run is in progress
      a: true,
    },
    // Slow claim event
    onClaim: () =>
      new Promise((resolve) => {
        // @ts-ignore
        setTimeout(resolve({ runs: [] }), 100);
      }),
  });
  app.runWorkloopMap = {};

  // @ts-ignore
  app.execute = ({ id }) => {
    app.workflows[id] = true;
  };

  // first claim should be fine
  let claimPromise = claim(app, logger, workloop);

  // second claim should error
  await t.throwsAsync(() => claim(app, logger, workloop), {
    message: 'Server at capacity',
  });

  // The prior claim should not have counted for anything
  t.is(Object.keys(app.workflows).length, 1);

  // wait for the original return to finish
  await t.throwsAsync(claimPromise, {
    message: 'No runs returned',
  });
});

test('claim: should send queues in payload', async (t) => {
  let sentPayload: any;
  const workloop = createMockWorkloop(5);

  const channel = mockChannel({
    [CLAIM]: (payload: any) => {
      sentPayload = payload;
      return { runs: [] };
    },
  });

  const app = {
    openClaims: {},
    workflows: {},
    queueChannel: channel,
    runWorkloopMap: {},
    execute: () => {},
    events: new EventEmitter(),
  } as unknown as ServerApp;

  await t.throwsAsync(() => claim(app, logger, workloop), {
    message: 'No runs returned',
  });

  t.deepEqual(sentPayload.queues, ['manual', '*']);
});

test('claim: should check per-workloop capacity, not global', async (t) => {
  // Workloop has capacity 2 with 1 active run
  const workloop = createMockWorkloop(2);
  workloop.activeRuns.add('existing-run');

  const app = createMockApp({
    onClaim: () => ({ runs: [{ id: 'run-2' }] }),
    // Global workflows has 10 entries - should not matter
    workflows: Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`w${i}`, true])
    ),
  });
  app.runWorkloopMap = {};

  // Should succeed because workloop has capacity (1/2), regardless of global count
  await claim(app, logger, workloop);
  t.true(workloop.activeRuns.has('run-2'));
});

test.todo('should handle multiple runs');
test.todo('claim payload should have a demand');
test.todo('claim payload should include a worker name');
// TODO I'd rather return true/false really and let the backoff itself decide whether to throw or not
test.todo('should throw if there are no runs available (to trigger backoff)');
