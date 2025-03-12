import test from 'ava';
import { createMockLogger } from '@openfn/logger';
import * as Sentry from '@sentry/node';
import sentryTestkit from 'sentry-testkit';

import { mockChannel } from '../../src/mock/sockets';
import { createRunState, sendEvent } from '../../src/util';
import { LightningSocketError, LightningTimeoutError } from '../../src/errors';
import { sleep } from '../util';

const { testkit, sentryTransport } = sentryTestkit();
Sentry.init({
  dsn: 'https://296274784378f87245c369278a62b29a@o55451.ingest.us.sentry.io/4508936084848640',
  transport: sentryTransport,
});

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

test.serial('should throw if the event timesout', async (t) => {
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

  // Telemetry will asynchronously submit the report in the background
  // We have to wait for it here in this nasty loop :(
  while (true) {
    await sleep(1);
    const reports = testkit.reports();
    if (reports.length) {
      t.is(reports.length, 1);
      t.is(reports[0].error?.name, 'LightningSocketError');
      break;
    }
  }
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

  // Telemetry will asynchronously submit the report in the background
  // We have to wait for it here in this nasty loop :(
  while (true) {
    await sleep(1);
    const reports = testkit.reports();
    if (reports.length) {
      t.is(reports.length, 1);
      t.is(reports[0].error?.name, 'LightningTimeoutError');
      break;
    }
  }
});
