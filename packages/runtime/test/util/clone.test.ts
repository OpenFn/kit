import test from 'ava';
import { asyncClone } from '../../src/util/clone';

test('asyncClone: should clone a simple object', async (t) => {
  const obj = {
    a: 1,
    b: 'hello',
    c: true,
    d: { nested: 'value' },
  };
  const result = await asyncClone(obj);
  t.deepEqual(result, obj);
  t.not(result, obj); // ensure it's a new object
  t.not(result.d, obj.d); // ensure nested objects are cloned
});

test('asyncClone: should remove undefined values', async (t) => {
  const obj = {
    a: 1,
    b: undefined,
    c: 'hello',
  };
  const result = await asyncClone(obj);
  t.deepEqual(result, { a: 1, c: 'hello' });
  t.false('b' in result);
});

test('asyncClone: should remove functions', async (t) => {
  const obj = {
    a: 1,
    b: () => 'test',
    c: 'hello',
  };
  const result = await asyncClone(obj);
  t.deepEqual(result, { a: 1, c: 'hello' });
  t.false('b' in result);
});

test('asyncClone: should handle arrays', async (t) => {
  const obj = {
    items: [1, 2, 3, { nested: 'value' }],
  };
  const result = await asyncClone(obj);
  t.deepEqual(result, obj);
  t.not(result, obj);
  t.not(result.items, obj.items);
});

test('asyncClone: should handle circular references', async (t) => {
  const inner: any = { value: 42 };
  const obj: any = {
    a: 1,
    inner: inner,
  };
  inner.parent = obj; // create circular reference

  const result = await asyncClone(obj);
  t.is(result.a, 1);
  t.is(result.inner.value, 42);
  // Circular reference should be handled without throwing
  t.truthy(result.inner.parent);
  t.is(result.inner.parent, '[Circular]');
});

test('asyncClone: should throw error when size exceeds limit', async (t) => {
  // Create an object slightly larger than 0.1MB (~0.2MB)
  const largeArray = new Array(1000).fill('x'.repeat(200));
  const obj = { items: largeArray };

  const error = await t.throwsAsync(
    async () => await asyncClone(obj, 0.1), // 0.1MB limit
    { instanceOf: Error }
  );
  t.regex(error.message, /State size exceeds limit/);
});
