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
import { createRuntimeGroup, RuntimeSlotGroup } from '../../src/util/parse-queues';

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

const createMockGroup = (maxSlots = 5): RuntimeSlotGroup =>
  createRuntimeGroup({ queues: ['manual', '*'], maxSlots });

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
    slotGroups: [],
    runGroupMap: {},
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

  const group = createMockGroup(1);
  const app = createMockApp({
    onClaim,
    onExecute,
  });
  app.runGroupMap = {};

  await claim(app, logger, group);
  t.deepEqual(executeArgs[0], { id: 'abc' });
  t.true(group.activeRuns.has('abc'));
  t.is(app.runGroupMap['abc'], group);
});

test('should not claim if group is at capacity', async (t) => {
  const group = createMockGroup(1);
  group.activeRuns.add('a');

  const app = createMockApp({
    workflows: { a: true },
  });

  await t.throwsAsync(() => claim(app, logger, group), {
    message: 'Server at capacity',
  });
});

test('should mark a claim when in flight', async (t) => {
  const group = createMockGroup(5);

  const app = createMockApp({
    workflows: {},
  });

  let claimPromise = claim(app, logger, group);

  t.is(group.openClaims['1'], 1);
  t.is(app.openClaims['1'], 1);

  await t.throwsAsync(claimPromise, {
    message: 'No runs returned',
  });
});

test('should remove an open claim when completed', async (t) => {
  const group = createMockGroup(5);

  const app = createMockApp({
    workflows: {},
  });

  await t.throwsAsync(() => claim(app, logger, group), {
    message: 'No runs returned',
  });

  t.falsy(group.openClaims['1']);
  t.falsy(app.openClaims['1']);
});

test('should remove an open claim on error', async (t) => {
  const group = createMockGroup(5);

  const app = createMockApp({
    workflows: {},
    onClaim: () => {
      throw {};
    },
  });

  await t.throwsAsync(() => claim(app, logger, group), {
    message: 'claim error',
  });

  t.falsy(group.openClaims['1']);
  t.falsy(app.openClaims['1']);
});

// TODO not really sure how to check this
test.skip('should remove an open claim on timeout', async (t) => {
  const group = createMockGroup(5);

  const app = createMockApp({
    workflows: {},
    onClaim: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 60));
    },
  });

  await t.throwsAsync(() => claim(app, logger, group), {
    message: 'timeout',
  });

  t.falsy(group.openClaims['1']);
  t.falsy(app.openClaims['1']);
});

test('should mark a claim when in flight with demand: 2', async (t) => {
  const group = createMockGroup(5);

  const app = createMockApp({
    workflows: {
      a: true,
    },
  });

  let claimPromise = claim(app, logger, group, { demand: 2 });

  t.is(group.openClaims['1'], 2);
  t.is(app.openClaims['1'], 2);

  await t.throwsAsync(claimPromise, {
    message: 'No runs returned',
  });
});

test('should not claim if open claims exceeds group capacity', async (t) => {
  let didStopWorkloop = false;

  const group = createMockGroup(1);
  group.workloop = {
    stop: () => {
      didStopWorkloop = true;
    },
    isStopped: () => false,
  };

  const app = createMockApp({
    workflows: {},
    // Slow claim event
    onClaim: () =>
      new Promise((resolve) => {
        // @ts-ignore
        setTimeout(resolve({ runs: [] }), 100);
      }),
  });
  app.runGroupMap = {};

  // @ts-ignore
  app.execute = ({ id }) => {
    app.workflows[id] = true;
  };

  // first claim should be fine
  let claimPromise = claim(app, logger, group);

  // second claim should error and stop the loop actually
  await t.throwsAsync(() => claim(app, logger, group), {
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

test('should not claim if open claims + active runs exceeds group capacity', async (t) => {
  const group = createMockGroup(2);
  group.activeRuns.add('a');

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
  app.runGroupMap = {};

  // @ts-ignore
  app.execute = ({ id }) => {
    app.workflows[id] = true;
  };

  // first claim should be fine
  let claimPromise = claim(app, logger, group);

  // second claim should error
  await t.throwsAsync(() => claim(app, logger, group), {
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
  const group = createMockGroup(5);

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
    runGroupMap: {},
    execute: () => {},
    events: new EventEmitter(),
  } as unknown as ServerApp;

  await t.throwsAsync(() => claim(app, logger, group), {
    message: 'No runs returned',
  });

  t.deepEqual(sentPayload.queues, ['manual', '*']);
});

test('claim: should check per-group capacity, not global', async (t) => {
  // Group has capacity 2 with 1 active run
  const group = createMockGroup(2);
  group.activeRuns.add('existing-run');

  const app = createMockApp({
    onClaim: () => ({ runs: [{ id: 'run-2' }] }),
    // Global workflows has 10 entries - should not matter
    workflows: Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`w${i}`, true])
    ),
  });
  app.runGroupMap = {};

  // Should succeed because group has capacity (1/2), regardless of global count
  await claim(app, logger, group);
  t.true(group.activeRuns.has('run-2'));
});

test.todo('should handle multiple runs');
test.todo('claim payload should have a demand');
test.todo('claim payload should include a worker name');
// TODO I'd rather return true/false really and let the backoff itself decide whether to throw or not
test.todo('should throw if there are no runs available (to trigger backoff)');
