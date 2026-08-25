import test from 'ava';
import execute from '../src/execute';

test.serial(
  'use lazy-state in template literal & property access',
  async (t) => {
    const state = {
      keyName: 'someKey',
      firstName: 'John',
      lastName: 'Doe',
    };
    const job = `
fnIf(\`$\{$.keyName\}\` === 'someKey', state => {
  state.literal = true;
  return state;
})

fnIf($.firstName + $['lastName'] === 'JohnDoe', state=> {
  state.concat = true;
  return state;
})`;

    const result = await execute(job, state);
    t.is(result.literal, true);
    t.is(result.concat, true);
  }
);

test.serial('state function called with lazy-state', async (t) => {
  const state = { data: {} };

  const job = `
fn((state) => {
    state.callMeMaybe = (value) => {
        state.data.greetings = "Hello " + value
		return state;
    }
    return state
});

fn(state => {
    state.data.name = "John"
    return state;
})

fn($.callMeMaybe($.data.name))`;

  const result = await execute(job, state);

  t.deepEqual(result, { data: { name: 'John', greetings: 'Hello John' } });
});

// Note: language-common's fn() passes the resolved argument through as the
// next state, so fn($.x) can be used to return state.x directly.
// This helper is a minimal "adaptor operation" which resolves a lazy-state
// argument the same way real adaptor operations do (via expandReferences).
const helpers = `
const resolve = (state, value) => typeof value === 'function' ? value(state) : value;
const upsert = (name, obj) => state => {
  state.upserts ??= [];
  state.upserts.push({ name, ...resolve(state, obj) });
  return state;
};
`;

/*
 * Basic reads
 */

test.serial('read a top-level boolean in a condition', async (t) => {
  const state = { ready: true };
  const job = `fnIf($.ready, fn(state => {
  state.ran = true;
  return state;
}))`;

  const result = await execute(job, state);
  t.true(result.ran);
});

test.serial('read a nested path', async (t) => {
  const state = { data: { patient: { name: 'Alice' } } };
  const job = `fnIf($.data.patient.name === 'Alice', fn(state => {
  state.matched = true;
  return state;
}))`;

  const result = await execute(job, state);
  t.true(result.matched);
});

test.serial('read an array index', async (t) => {
  const state = { data: { items: [{ id: 'first' }, { id: 'second' }] } };
  const job = `fnIf($.data.items[1].id === 'second', fn(state => {
  state.matched = true;
  return state;
}))`;

  const result = await execute(job, state);
  t.true(result.matched);
});

test.serial('read a missing path with optional chaining', async (t) => {
  const state = { data: {} };
  const job = `fnIf($.data.missing?.id, fn(state => {
  state.ran = true;
  return state;
}))`;

  const result = await execute(job, state);
  t.is(result.ran, undefined);
});

test.serial('return a value read from state as the next state', async (t) => {
  const state = { data: { x: 1 }, other: 'stuff' };
  const job = `fn($.data)`;

  const result = await execute(job, state);
  t.deepEqual(result, { x: 1 });
});

/*
 * Expressions
 */

test.serial('use lazy-state in arithmetic', async (t) => {
  const state = { report: { revenue: 100, expenses: 40 } };
  const job = `fnIf($.report.revenue - $.report.expenses === 60, fn(state => {
  state.profit = true;
  return state;
}))`;

  const result = await execute(job, state);
  t.true(result.profit);
});

test.serial('use lazy-state in logical expressions', async (t) => {
  const state = { a: true, b: false };
  const job = `fnIf($.a && !$.b, fn(state => {
  state.and = true;
  return state;
}))

fnIf($.b || $.a, fn(state => {
  state.or = true;
  return state;
}))`;

  const result = await execute(job, state);
  t.true(result.and);
  t.true(result.or);
});

test.serial('use lazy-state in a ternary', async (t) => {
  const state = { data: { status: 'active' } };
  const job = `fn($.data.status === 'active' ? { result: 'yes' } : { result: 'no' })`;

  const result = await execute(job, state);
  t.deepEqual(result, { result: 'yes' });
});

test.serial('use lazy-state as a dynamic property key', async (t) => {
  const state = { location: { country: 'Kenya' } };
  const job = `const codes = { Kenya: 'KE', Uganda: 'UG' };

fn(codes[$.location.country])`;

  const result = await execute(job, state);
  t.is(result as unknown as string, 'KE');
});

/*
 * Objects, mapping and iteration
 */

test.serial('map state into an object argument', async (t) => {
  const state = { data: { first: 'Ada', last: 'Lovelace', age: 36 } };
  const job = `${helpers}
upsert('person', {
  fullName: $.data.first + ' ' + $.data.last,
  age: $.data.age,
})`;

  const result = await execute(job, state);
  t.deepEqual(result.upserts, [
    { name: 'person', fullName: 'Ada Lovelace', age: 36 },
  ]);
});

test.serial('use lazy-state as the data source for each()', async (t) => {
  const state = { data: { items: [1, 2, 3] }, total: 0 };
  const job = `each($.data.items, fn(state => {
  state.total += state.data;
  return state;
}))`;

  const result = await execute(job, state);
  t.is(result.total, 6);
});

test.serial('read the current item inside each()', async (t) => {
  const state = { data: { patients: [{ id: 'a' }, { id: 'b' }] } };
  const job = `${helpers}
each($.data.patients, upsert('patient', { id: $.data.id }))`;

  const result = await execute(job, state);
  t.deepEqual(result.upserts, [
    { name: 'patient', id: 'a' },
    { name: 'patient', id: 'b' },
  ]);
});

test.serial('use lazy-state for both arguments of group()', async (t) => {
  const state = {
    data: {
      rows: [
        { type: 'x', v: 1 },
        { type: 'y', v: 2 },
        { type: 'x', v: 3 },
      ],
    },
    keyPath: 'type',
  };
  const job = `group($.data.rows, $.keyPath)`;

  const result = await execute(job, state);
  t.deepEqual(result.data, {
    x: [
      { type: 'x', v: 1 },
      { type: 'x', v: 3 },
    ],
    y: [{ type: 'y', v: 2 }],
  });
});

/*
 * Scoping
 */

test.serial('do not convert a $ parameter', async (t) => {
  const state = { data: {} };
  const job = `fn(($) => {
  $.data.x = 1;
  return $;
})`;

  const result = await execute(job, state);
  t.deepEqual(result, { data: { x: 1 } });
});

test.serial('do not convert a locally declared $', async (t) => {
  const state = { data: {} };
  const job = `fn((state) => {
  const $ = { a: 5 };
  state.data.a = $.a;
  return state;
})`;

  const result = await execute(job, state);
  t.deepEqual(result, { data: { a: 5 } });
});

test.serial('do not convert $ inside a string', async (t) => {
  const state = { data: {} };
  const job = `fn((state) => {
  state.data.str = "$.data.a";
  return state;
})`;

  const result = await execute(job, state);
  t.deepEqual(result, { data: { str: '$.data.a' } });
});

/*
 * Illegal usage (compile-time errors)
 */

test.serial('throw if $ is assigned to a variable', async (t) => {
  const state = { data: { url: 'x' } };
  const job = `const url = $.data.url;
fn(state => state)`;

  await t.throwsAsync(() => execute(job, state), {
    message: /must be inside an operation/i,
  });
});

test.serial('throw if $ is used inside a nullary arrow', async (t) => {
  const state = { data: { url: 'x' } };
  const job = `fn(() => $.data.url)`;

  await t.throwsAsync(() => execute(job, state), {
    message: /wrong arity/i,
  });
});

test.serial(
  'throw if $ is used inside an arrow whose parameter is not called state',
  async (t) => {
    const state = { flag: true };
    const job = `fnIf((s) => $.flag, fn(state => state))`;

    await t.throwsAsync(() => execute(job, state), {
      message: /parameter "s" should be called "state"/i,
    });
  }
);

test.serial('throw if $ is written to at the top level', async (t) => {
  const state = { data: {} };
  const job = `$.data.x = 10;`;

  await t.throwsAsync(() => execute(job, state), {
    message: /must be inside an operation/i,
  });
});

test.serial('throw if $ is written to inside an operation', async (t) => {
  const state = { data: {} };
  const job = `fn(state => {
  $.data.x = 10;
  return state;
})`;

  await t.throwsAsync(() => execute(job, state), {
    message: /must be inside an operation/i,
  });
});
