import test from 'ava';
import {
  WORKFLOW_START,
  WORKFLOW_COMPLETE,
  JOB_START,
  JOB_COMPLETE,
  WORKFLOW_LOG,
  JOB_ERROR,
  WORKFLOW_ERROR,
} from '@openfn/engine-multi';

import { eventProcessor } from '../../src/api/process-events';
import createMockEngine from '../../src/mock/runtime-engine';

import type { ExecutionPlan } from '@openfn/lexicon';
import { createMockLogger } from '@openfn/logger';

const logger = createMockLogger();

test.afterEach(() => {
  logger._reset();
});

const waitForAsync = (delay = 10) =>
  new Promise<void>((resolve) => setTimeout(resolve, delay));

const createPlan = (...expressions: string[]) =>
  ({
    id: 'a',
    workflow: {
      steps: expressions.length
        ? expressions.map((e, idx) => ({
            id: `${idx}`,
            expression: e,
            adaptors: [],
            next: expressions[idx + 1] ? { [`${idx + 1}`]: true } : {},
          }))
        : [{ expression: 'fn(s => s)' }],
    },
    options: {},
  } as ExecutionPlan);

test('should process a workflow-start event and call the callback', async (t) => {
  t.plan(3);

  const engine = await createMockEngine();
  const plan = createPlan();

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const callbacks = {
    [WORKFLOW_START]: (ctx: any, event: any) => {
      t.is(context, ctx);
      t.is(event.workflowId, 'a');
      t.truthy(event.threadId);
    },
  };

  eventProcessor(engine, context as any, callbacks);

  // Execute a simple workflow to trigger the event
  await engine.execute(plan, {});

  await waitForAsync();
});

test('should process a workflow-complete event and call the callback', async (t) => {
  t.plan(4);

  const engine = await createMockEngine();
  const plan = createPlan('fn(() => ({ data: { x: 10 } }))');

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const callbacks = {
    [WORKFLOW_COMPLETE]: (ctx: any, event: any) => {
      t.is(context, ctx);
      t.is(event.workflowId, 'a');
      t.truthy(event.threadId);
      t.deepEqual(event.state, { data: { x: 10 } });
    },
  };

  eventProcessor(engine, context as any, callbacks);

  await engine.execute(plan, {});
  await waitForAsync();
});

test('should process a job-start event and call the callback', async (t) => {
  t.plan(4);

  const engine = await createMockEngine();
  const plan = createPlan();

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const callbacks = {
    [JOB_START]: (ctx: any, event: any) => {
      t.is(context, ctx);
      t.is(event.workflowId, 'a');
      t.truthy(event.threadId);
      t.truthy(event.jobId);
    },
  };

  eventProcessor(engine, context as any, callbacks);

  await engine.execute(plan, {});
  await waitForAsync();
});

test('should process a job-complete event and call the callback', async (t) => {
  t.plan(5);

  const engine = await createMockEngine();
  const plan = createPlan('fn(() => ({ data: { result: 42 } }))');

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const callbacks = {
    [JOB_COMPLETE]: (ctx: any, event: any) => {
      t.is(context, ctx);
      t.is(event.workflowId, 'a');
      t.truthy(event.threadId);
      t.truthy(event.jobId);
      t.deepEqual(event.state, { data: { result: 42 } });
    },
  };

  eventProcessor(engine, context as any, callbacks);

  await engine.execute(plan, {});
  await waitForAsync();
});

test('should process a workflow-log event and call the callback', async (t) => {
  t.plan(4);

  const engine = await createMockEngine();
  const plan = createPlan('fn((s) => { console.log("test log"); return s; })');

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const callbacks = {
    [WORKFLOW_LOG]: (ctx: any, event: any) => {
      t.is(context, ctx);
      t.is(event.workflowId, 'a');
      t.truthy(event.threadId);
      t.truthy(event.message);
    },
  };

  eventProcessor(engine, context as any, callbacks);

  await engine.execute(plan, {});
  await waitForAsync();
});

test('should process a job-error event and call the callback', async (t) => {
  t.plan(4);

  const engine = await createMockEngine();
  const plan = createPlan('fn(() => { throw new Error("job error"); })');

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const callbacks = {
    [JOB_ERROR]: (ctx: any, event: any) => {
      t.is(context, ctx);
      t.is(event.workflowId, 'a');
      t.truthy(event.threadId);
      t.truthy(event.error);
    },
  };

  eventProcessor(engine, context as any, callbacks);

  await engine.execute(plan, {});
  await new Promise((resolve) => setTimeout(resolve, 50));
});

test('should process a workflow-error event and call the callback', async (t) => {
  t.plan(5);

  const engine = await createMockEngine();
  const plan = createPlan('fn(() => ( @~!"@£!4 )'); // Invalid syntax to trigger error

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const callbacks = {
    [WORKFLOW_ERROR]: (ctx: any, event: any) => {
      t.is(context, ctx);
      t.is(event.workflowId, 'a');
      t.truthy(event.threadId);
      t.truthy(event.type);
      t.truthy(event.message);
    },
  };

  eventProcessor(engine, context as any, callbacks);

  await engine.execute(plan, {});
  await new Promise((resolve) => setTimeout(resolve, 50));
});

test('should process events in the correct order', async (t) => {
  const engine = await createMockEngine();
  const plan = createPlan(
    `fn((s) => {
      console.log(1);
      console.log(2);
      console.log(3);
      return {};
    })`
  );

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const events: Array<{ type: string; workflowId: string; message?: any }> = [];

  const callbacks = {
    [WORKFLOW_START]: (_ctx: any, event: any) => {
      events.push({ type: 'workflow-start', workflowId: event.workflowId });
    },
    [JOB_START]: (_ctx: any, event: any) => {
      events.push({ type: 'job-start', workflowId: event.workflowId });
    },
    [WORKFLOW_LOG]: (_ctx: any, event: any) => {
      events.push({
        type: 'workflow-log',
        workflowId: event.workflowId,
        message: event.message,
      });
    },
    [JOB_COMPLETE]: (_ctx: any, event: any) => {
      events.push({ type: 'job-complete', workflowId: event.workflowId });
    },
    [WORKFLOW_COMPLETE]: (_ctx: any, event: any) => {
      events.push({ type: 'workflow-complete', workflowId: event.workflowId });
    },
  };

  eventProcessor(engine, context as any, callbacks);

  await engine.execute(plan, {});
  await waitForAsync();

  t.is(events.length, 7);
  t.is(events[0].type, 'workflow-start');
  t.is(events[1].type, 'job-start');

  t.is(events[2].type, 'workflow-log');
  t.is(events[2].message, '[1]');

  t.is(events[3].type, 'workflow-log');
  t.is(events[3].message, '[2]');

  t.is(events[4].type, 'workflow-log');
  t.is(events[4].message, '[3]');

  t.is(events[5].type, 'job-complete');
  t.is(events[6].type, 'workflow-complete');

  // Verify all events have the correct workflowId
  t.assert(events.every((e) => e.workflowId === 'a'));
});

test('should batch sequential log events', async (t) => {
  t.plan(4);

  const engine = await createMockEngine();
  const plan = createPlan(
    `fn((s) => {
      console.log(1);
      console.log(2);
      console.log(3);
      return {};
    })`
  );

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const callbacks = {
    [WORKFLOW_LOG]: (_ctx: any, events: any) => {
      t.is(events.length, 3);
      t.is(events[0].message, '[1]');
      t.is(events[1].message, '[2]');
      t.is(events[2].message, '[3]');
    },
  };

  const options = {
    batch: {
      [WORKFLOW_LOG]: true,
    },
  };

  eventProcessor(engine, context as any, callbacks, options);

  await engine.execute(plan, {});
  await waitForAsync(50);
});

// 3 logs will be sent within 10ms, but they'll be interrupted by step:complete and step:start
test('should interrupt a batch of log events', async (t) => {
  const engine = await createMockEngine();
  const plan = createPlan(
    `fn((s) => {
      console.log(1);
      console.log(2);
    })`,
    `fn((s) => {
      console.log(3);
    })`
  );

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const events: number[] = [];

  let stepCompleteCounter = 0;

  const callbacks = {
    [WORKFLOW_LOG]: (_ctx: any, event: any) => {
      events.push(event.length);
    },
    [JOB_COMPLETE]: () => {
      stepCompleteCounter++;
    },
  };

  const options = {
    batch: {
      [WORKFLOW_LOG]: true,
    },
  };

  eventProcessor(engine, context as any, callbacks, options);

  await engine.execute(plan, {});

  await waitForAsync(50);

  t.is(stepCompleteCounter, 2);

  const [first, second] = events;
  t.is(first, 2);
  t.is(second, 1);
});

test('should respect the limit', async (t) => {
  const engine = await createMockEngine();
  const plan = createPlan(
    `fn((s) => {
      console.log(1);
      console.log(2);
      console.log(3);
      console.log(4);
      return {};
    })`
  );

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const events: any[] = [];

  const callbacks = {
    [WORKFLOW_LOG]: (_ctx: any, event: any) => {
      events.push(event);
    },
  };

  const options = {
    batch: {
      [WORKFLOW_LOG]: true,
    },
    batchLimit: 2,
  };

  eventProcessor(engine, context as any, callbacks, options);

  await engine.execute(plan, {});
  await waitForAsync(50);

  t.is(events.length, 2);
  t.is(events[0].length, 2);
  t.is(events[1].length, 2);
});

test('should respect the interval', async (t) => {
  const engine = await createMockEngine();
  const plan = createPlan(
    `fn(async (s) => {
      console.log(1);
      await new Promise((resolve) => setTimeout(() => resolve(s), 5)),
      console.log(3);
      return {};
    })`
  );

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const events: any[] = [];

  const callbacks = {
    [WORKFLOW_LOG]: (_ctx: any, event: any) => {
      events.push(event);
    },
  };

  const options = {
    batch: {
      [WORKFLOW_LOG]: true,
    },
    batchInterval: 2,
  };

  eventProcessor(engine, context as any, callbacks, options);

  await engine.execute(plan, {});
  await waitForAsync(50);

  t.is(events.length, 2);
  t.is(events[0].length, 1);
  t.is(events[1].length, 1);
});

test('should handle two batches of logs', async (t) => {
  const engine = await createMockEngine();
  // syntax is weird because of how the fake RTE works
  const plan = createPlan(
    `fn((s) => {
      // batch!
      console.log(11);
      console.log(12);
    }),
    wait(20),
    fn((s) => {
      // batch!
      console.log(21);
      console.log(22);
    })`
  );

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const events: number[] = [];

  const callbacks = {
    [WORKFLOW_LOG]: (_ctx: any, event: any) => {
      events.push(event.length);
    },
  };

  const options = {
    batch: {
      [WORKFLOW_LOG]: true,
    },
  };

  eventProcessor(engine, context as any, callbacks, options);

  await engine.execute(plan, {});

  await waitForAsync(50);

  const [first, second] = events;
  t.is(first, 2);
  t.is(second, 2);
});

test('should process events in the correct order with batching', async (t) => {
  const engine = await createMockEngine();
  const plan = createPlan(
    `fn((s) => {
      console.log(1);
      console.log(2);
      console.log(3);
      return {};
    })`
  );

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const events: Array<{ type: string; count?: any }> = [];

  const callbacks = {
    [WORKFLOW_START]: () => {
      events.push({ type: 'workflow-start' });
    },
    [JOB_START]: () => {
      events.push({ type: 'job-start' });
    },
    [WORKFLOW_LOG]: (_ctx: any, event: any) => {
      events.push({
        type: 'workflow-log',
        count: event.length,
      });
    },
    [JOB_COMPLETE]: () => {
      events.push({ type: 'job-complete' });
    },
    [WORKFLOW_COMPLETE]: () => {
      events.push({ type: 'workflow-complete' });
    },
  };

  const options = {
    batch: {
      [WORKFLOW_LOG]: true,
    },
  };

  eventProcessor(engine, context as any, callbacks, options);

  await engine.execute(plan, {});
  await waitForAsync(50);
  t.is(events.length, 5);
  t.is(events[0].type, 'workflow-start');
  t.is(events[1].type, 'job-start');

  t.is(events[2].type, 'workflow-log');
  t.is(events[2].count, 3);

  t.is(events[3].type, 'job-complete');
  t.is(events[4].type, 'workflow-complete');
});

test('queue events behind a slow event', async (t) => {
  const engine = await createMockEngine();
  const plan = createPlan(
    `fn((s) => {
      for(let i=0;i<10;i++) {
        console.log(i);
      }
    })`
  );
  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const events: number[] = [];

  const callbacks = {
    // the job start event should stall
    [JOB_START]: () => {
      return new Promise((resolve) => setTimeout(resolve, 50));
    },
    [WORKFLOW_LOG]: (_ctx: any, event: any) => {
      events.push(event.length);
    },
  };

  const options = {
    batch: {
      [WORKFLOW_LOG]: true,
    },
    // set the timeout super long
    // We don't want the regular timeout to fire
    // We want to instantly send the batch
    batchInterval: 5000,
  };

  eventProcessor(engine, context as any, callbacks, options);

  await engine.execute(plan, {});

  await waitForAsync(100);
  // Should only be one event triggered
  t.is(events.length, 1);

  // should be a batch of 10
  t.is(events[0], 10);
});

// This isn't the most watertight test - but I've debugged it closely and it seems
// to do the right thing
test('queue events behind a slow event II', async (t) => {
  const engine = await createMockEngine();
  const plan = createPlan(
    `
    // This first batch should be triggered from a full queue
    // after the start event
    fn((s) => {
      for(let i=0;i<10;i++) {
        console.log(i);
      }
    }),
    wait(50),
    // This second batch should be triggered
    // on the fly, and fire when full (not when timed out)
    fn((s) => {
      for(let i=100;i<110;i++) {
        console.log(i);
      }
    })`
  );
  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const events: number[] = [];

  const callbacks = {
    // the job start event should stall
    [JOB_START]: () => {
      return new Promise((resolve) => setTimeout(resolve, 50));
    },
    [WORKFLOW_LOG]: (_ctx: any, event: any) => {
      events.push(event.length);
    },
  };

  const options = {
    batch: {
      [WORKFLOW_LOG]: true,
    },
    // set the timeout super long
    // We don't want the regular timeout to fire
    // We want to instantly send the batch
    batchInterval: 5000,
  };

  eventProcessor(engine, context as any, callbacks, options);

  await engine.execute(plan, {});

  await waitForAsync(100);

  t.is(events.length, 2);
  t.is(events[0], 10);
  t.is(events[1], 10);
});

test('should timeout and continue processing when event handler hangs', async (t) => {
  const engine = await createMockEngine();
  const plan = createPlan();

  const context = {
    id: 'a',
    plan,
    options: {},
    logger,
  };

  const processedEvents: string[] = [];

  const callbacks = {
    [WORKFLOW_START]: () => {
      // Hang forever - don't resolve
      return new Promise(() => {});
    },
    [JOB_START]: () => {
      processedEvents.push('job-start');
    },
    [JOB_COMPLETE]: () => {
      processedEvents.push('job-complete');
    },
    [WORKFLOW_COMPLETE]: () => {
      processedEvents.push('workflow-complete');
    },
  };

  const options = {
    // If we disable the timeout, this test fails to process any event
    timeout_ms: 50,
  };

  eventProcessor(engine, context as any, callbacks, options);

  await engine.execute(plan, {});

  // Wait for timeout to fire and subsequent events to process
  await waitForAsync(100);

  // Check that the timeout error was logged
  const timeoutLog = logger._find('error', /timeout \(fallback\)/);
  t.truthy(timeoutLog);
  if (timeoutLog) {
    t.true((timeoutLog.message as string).includes('workflow-start'));
  }

  // Check that subsequent events were processed despite the timeout
  t.true(
    processedEvents.length > 0,
    `Expected events to be processed, got: ${processedEvents.join(', ')}`
  );
  t.true(processedEvents.includes('job-start'));
  t.true(processedEvents.includes('job-complete'));
  t.true(processedEvents.includes('workflow-complete'));
});
