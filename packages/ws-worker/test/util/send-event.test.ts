import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import { mockChannel } from '../../src/mock/sockets';
import { createRunState, sendEvent } from '../../src/util';
import { LightningSocketError, LightningTimeoutError } from '../../src/errors';
import { initSentry, sleep, waitForSentryReport } from '../util';

const testkit = initSentry();

const logger = createMockLogger(undefined, { json: true });

test.beforeEach(() => {
  testkit.reset();
  logger._reset();
});

test.afterEach(async () => {
  // Force a wait so that all sentry telemetry can process (grr)
  await sleep(10);
});

test.serial('should send a simple event', async (t) => {
  const EVENT_NAME = 'test';
  const channel = mockChannel({
    [EVENT_NAME]: () => {
      t.pass('message sent');
    },
  });

  const context = {
    id: 'x',
    channel,
    state: createRunState({
      id: 'x',
    } as any),
    logger,
  };

  await sendEvent(context, EVENT_NAME, {});
});

test.serial('should send a simple event with return data', async (t) => {
  const EVENT_NAME = 'test';
  const channel = mockChannel({
    [EVENT_NAME]: () => {
      return 22;
    },
  });

  const context = {
    id: 'x',
    channel,
    state: createRunState({
      id: 'x',
    } as any),
    logger,
  };

  const reply = await sendEvent(context, EVENT_NAME, {});
  t.is(reply, 22);
});

test.serial('should throw if the event is rejected', async (t) => {
  const EVENT_NAME = 'test';
  const channel = mockChannel({
    [EVENT_NAME]: () => {
      throw new Error('err');
    },
  });

  const context = {
    id: 'x',
    channel,
    state: createRunState({
      id: 'x',
    } as any),
    logger,
  };

  await t.throwsAsync(() => sendEvent(context, EVENT_NAME, {}), {
    instanceOf: LightningSocketError,
  });
});

test.serial('should throw if the event timesout and retry is 1', async (t) => {
  process.env.WORKER_TIMEOUT_RETRY_DELAY = '1';
  process.env.WORKER_TIMEOUT_RETRY_COUNT = '1';

  const EVENT_NAME = 'test';
  const channel = mockChannel({
    // No handler so no reply
  });

  const context = {
    id: 'x',
    channel,
    state: createRunState({
      id: 'x',
    } as any),
    logger,
  };

  await t.throwsAsync(() => sendEvent(context, EVENT_NAME, {}), {
    instanceOf: LightningTimeoutError,
  });
});

test.serial(
  'should throw after 5 attempts if the event timesout and retry is 5',
  async (t) => {
    process.env.WORKER_TIMEOUT_RETRY_DELAY = '1';
    process.env.WORKER_TIMEOUT_RETRY_COUNT = '5';

    const EVENT_NAME = 'test';
    const channel = mockChannel({
      // No handler so no reply
    });

    const context = {
      id: 'x',
      channel,
      state: createRunState({
        id: 'x',
      } as any),
      logger,
    };

    await t.throwsAsync(() => sendEvent(context, EVENT_NAME, {}), {
      instanceOf: LightningTimeoutError,
    });

    const events = logger._history.filter(
      ({ level, message }: any) =>
        level === 'warn' && /event test timed out/.test(message)
    );
    t.is(events.length, 4); // should retry 4 times and fail on the fifth!
  }
);

test.serial(
  'should pass after 5 attempts if the event timesout and retry is 5',
  async (t) => {
    process.env.WORKER_TIMEOUT_RETRY_DELAY = '1';
    process.env.WORKER_TIMEOUT_RETRY_COUNT = '5';
    let count = 0;

    const EVENT_NAME = 'test';
    const channel = mockChannel({
      [EVENT_NAME]: () => {
        return new Promise((resolve) => {
          count++;
          if (count === 5) {
            resolve(55);
          }
          resolve(null); // simulate timeout
        });
      },
    });

    const context = {
      id: 'x',
      channel,
      state: createRunState({
        id: 'x',
      } as any),
      logger,
    };

    const reply = await sendEvent(context, EVENT_NAME, {});
    t.is(reply, 55);

    const events = logger._history.filter(
      ({ level, message }: any) =>
        level === 'warn' && /event test timed out/.test(message)
    );
    t.is(events.length, 4); // should retry 4 times and pass on the fifth!
  }
);

test.serial('should log if the event is rejected', async (t) => {
  const EVENT_NAME = 'test';
  const channel = mockChannel({
    [EVENT_NAME]: () => {
      throw new Error('err');
    },
  });

  const context = {
    id: 'x',
    channel,
    state: createRunState({
      id: 'x',
    } as any),
    logger,
  };

  try {
    await sendEvent(context, EVENT_NAME, {});
  } catch (e) {}

  const [log] = logger._history as any[];

  t.is(log.level, 'error');
  t.regex(log.message[0], / error: err/i);
});

test.serial('should report to sentry if the event is rejected', async (t) => {
  const EVENT_NAME = 'test';
  const channel = mockChannel({
    [EVENT_NAME]: () => {
      throw new Error('err');
    },
  });

  const context = {
    id: 'x',
    channel,
    state: createRunState({
      id: 'x',
    } as any),
    logger,
  };

  try {
    await sendEvent(context, EVENT_NAME, {});
  } catch (e: any) {
    t.true(e.reportedToSentry);
  }

  const reports = await waitForSentryReport(testkit);
  t.is(reports[0].error?.name, 'LightningSocketError');
});

test.serial('should report to sentry if the event timesout', async (t) => {
  const EVENT_NAME = 'test';
  const channel = mockChannel({});

  const context = {
    id: 'x',
    channel,
    state: createRunState({
      id: 'x',
    } as any),
    logger,
  };

  try {
    await sendEvent(context, EVENT_NAME, {});
  } catch (e: any) {
    t.true(e.reportedToSentry);
  }
  const reports = await waitForSentryReport(testkit);
  t.is(reports[0].error?.name, 'LightningTimeoutError');
});
