import test from 'ava';

import createLogBatcher from '../../src/util/log-batcher';

const ctx = {};

test('batch multiple items added within timeout window', async (t) => {
  const batches: number[][] = [];

  const callback = async (items: number[]) => {
    batches.push(items);
  };

  const batcher = createLogBatcher(callback, { timeoutMs: 10 });

  // Add 3 items quickly
  batcher(ctx, 1);
  batcher(ctx, 2);
  batcher(ctx, 3);

  // Wait for the timeout to flush
  await new Promise((resolve) => setTimeout(resolve, 20));

  // Should have batched all 3 items together
  t.is(batches.length, 1);
  t.deepEqual(batches[0], [1, 2, 3]);
});

test('create separate batches for items added after timeout', async (t) => {
  const batches: number[][] = [];

  const callback = async (items: number[]) => {
    batches.push(items);
  };

  const batcher = createLogBatcher(callback, { timeoutMs: 10 });

  // Add first batch
  batcher(ctx, 1);
  batcher(ctx, 2);

  // Wait for timeout to flush first batch
  await new Promise((resolve) => setTimeout(resolve, 20));

  // Add second batch
  batcher(ctx, 3);
  batcher(ctx, 4);

  // Wait for timeout to flush second batch
  await new Promise((resolve) => setTimeout(resolve, 20));

  // Should have two separate batches
  t.is(batches.length, 2);
  t.deepEqual(batches[0], [1, 2]);
  t.deepEqual(batches[1], [3, 4]);
});

test('batch with very short timeout (1ms)', async (t) => {
  const batches: number[][] = [];

  const callback = async (items: number[]) => {
    batches.push(items);
  };

  const batcher = createLogBatcher(callback, { timeoutMs: 1 });

  // Add items quickly
  batcher(ctx, 1);
  batcher(ctx, 2);
  batcher(ctx, 3);

  // Wait slightly longer than timeout
  await new Promise((resolve) => setTimeout(resolve, 5));

  // Should still batch them together since they were added synchronously
  t.is(batches.length, 1);
  t.deepEqual(batches[0], [1, 2, 3]);
});
