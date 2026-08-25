import test from 'ava';
import { EventEmitter } from 'node:events';
import * as Sentry from '@sentry/node';
import { createMockLogger } from '@openfn/logger';

import { mockChannel } from '../../src/mock/sockets';
import { createRunState, sendEvent } from '../../src/util';
import { LightningSocketError, LightningTimeoutError } from '../../src/errors';
import { initSentry, sleep, waitForSentryReport } from '../util';

const testkit = initSentry();

const logger = createMockLogger(undefined, { json: true });

// The real phoenix channel invokes its receive callbacks from the socket's
// message chain, which is not the chain that called push(). mockChannel defers
// with a setTimeout created inside push, so async context leaks through it and
// it cannot exercise this. This mock replies from a pump created up-front, so
// the callback runs with no inherited context, exactly like the real socket
const mockDetachedChannel = () => {
  const bus = new EventEmitter();
  const pump = setInterval(() => bus.emit('reply'), 1);

  return {
    stop: () => clearInterval(pump),
    channel: {
      push: () => {
        const responses = {} as Record<string, (e?: any) => void>;
        bus.once('reply', () => responses.error?.('detached'));

        const receive = {
          receive: (status: string, callback: (e?: any) => void) => {
            responses[status] = callback;
            return receive;
          },
        };
        return receive;
      },
    } as any,
  };
};

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
    options: {},
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
    options: {},
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
    options: {},
  };

  await t.throwsAsync(() => sendEvent(context, EVENT_NAME, {}), {
    instanceOf: LightningSocketError,
  });
});

test.serial('should throw if the event timesout and retry is 1', async (t) => {
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
    options: {},
  };

  await t.throwsAsync(() => sendEvent(context, EVENT_NAME, {}), {
    instanceOf: LightningTimeoutError,
  });

  // Check it did not retry at all
  const events = logger._history.filter(
    ({ level, message }: any) =>
      level === 'warn' && /event test timed out/.test(message)
  );
  t.is(events.length, 0);
});

// This behaviour is disabled and this test will likely be removed soon
test.serial.skip(
  'should throw after 5 attempts if the event timesout and retry is 5',
  async (t) => {
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
      options: {
        timeoutRetryCount: 5,
        timeoutRetryDelay: 1,
      },
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

// This behaviour is disabled and this test will likely be removed soon
test.serial.skip(
  'should pass after 5 attempts if the event timesout and retry is 5',
  async (t) => {
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
      options: {
        timeoutRetryCount: 5,
        timeoutRetryDelay: 1,
      },
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
    options: {},
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
    options: {},
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
    options: {},
  };

  try {
    await sendEvent(context, EVENT_NAME, {});
  } catch (e: any) {
    t.true(e.reportedToSentry);
  }
  const reports = await waitForSentryReport(testkit);
  t.is(reports[0].error?.name, 'LightningTimeoutError');

  // Tags are indexed (unlike the run context below), so these are what make
  // it possible to ask sentry "is it only step:complete that times out?"
  t.is(reports[0].tags.run_id, 'x');
  t.is(reports[0].tags.lightning_event, EVENT_NAME);
});

test.serial(
  'should fingerprint sentry reports by error type and event name',
  async (t) => {
    // Without this, every timeout for every event collapses into one sentry
    // issue - this is the change that would have made the step:complete
    // pattern visible without digging through raw events. Each event is
    // checked against a fresh testkit so the two reports cannot be confused
    // with each other or raced against waitForSentryReport's "at least one"
    // polling.
    const channelA = mockChannel({});
    await t.throwsAsync(() =>
      sendEvent(
        { id: 'x', channel: channelA, logger, options: {} },
        'step:complete',
        {}
      )
    );
    const [stepReport] = await waitForSentryReport(testkit);
    t.deepEqual(stepReport.originalReport.fingerprint, [
      'LightningTimeoutError',
      'step:complete',
    ]);

    testkit.reset();

    const channelB = mockChannel({});
    await t.throwsAsync(() =>
      sendEvent(
        { id: 'x', channel: channelB, logger, options: {} },
        'run:complete',
        {}
      )
    );
    const [runReport] = await waitForSentryReport(testkit);
    t.deepEqual(runReport.originalReport.fingerprint, [
      'LightningTimeoutError',
      'run:complete',
    ]);
  }
);

test.serial(
  'should report channel and socket state alongside a failed event',
  async (t) => {
    // Distinguishes a genuine failure on a healthy channel from collateral
    // damage while the channel is mid-rejoin after a drop
    const channel = {
      ...mockChannel({}),
      state: 'errored',
      socket: { connectionState: () => 'connecting' },
    };

    await t.throwsAsync(() =>
      sendEvent({ id: 'x', channel, logger, options: {} }, 'step:complete', {})
    );

    const reports = await waitForSentryReport(testkit);
    t.is(reports[0].extra?.channel_state, 'errored');
    t.is(reports[0].extra?.socket_state, 'connecting');
  }
);

test.serial('should report to sentry against the run scope', async (t) => {
  const sentryScope = Sentry.getIsolationScope().clone();
  sentryScope.setTag('run_id', 'run-1');
  sentryScope.addBreadcrumb({ category: 'event', message: 'job-complete' });

  const { channel, stop } = mockDetachedChannel();
  const context = { id: 'run-1', channel, logger, options: {}, sentryScope };

  await t.throwsAsync(() => sendEvent(context, 'step:complete', {}));
  stop();

  const reports = await waitForSentryReport(testkit);
  t.is(reports[0].error?.name, 'LightningSocketError');
  t.is(reports[0].tags.run_id, 'run-1');

  // The run's breadcrumb trail must survive too - this is why the capture
  // re-enters the scope rather than passing it to captureException, which
  // merges tags but drops breadcrumbs
  const trail = reports[0].originalReport?.breadcrumbs ?? [];
  t.true(trail.some((b: any) => b.message === 'job-complete'));
});

test.serial(
  'should report caller-supplied sentryExtras alongside a failed event',
  async (t) => {
    const EVENT_NAME = 'test';
    const channel = { ...mockChannel({}), state: 'joined' };

    const context = { id: 'x', channel, logger, options: {} };

    await t.throwsAsync(() =>
      sendEvent(
        context,
        EVENT_NAME,
        {},
        { sentryExtras: { payloadSize_b: 1536 } }
      )
    );

    const reports = await waitForSentryReport(testkit);
    t.is(reports[0].extra?.payloadSize_b, 1536);
    // sentryExtras must not crowd out the fields send-event already reports
    t.is(reports[0].extra?.channel_state, 'joined');
  }
);
