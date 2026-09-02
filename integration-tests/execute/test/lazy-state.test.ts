import test from 'ava';
import execute from '../src/execute';

const helpers = `
const resolve = (state, value) => typeof value === 'function' ? value(state) : value;
const upsert = (name, obj) => state => {
  state.upserts ??= [];
  state.upserts.push({ name, ...resolve(state, obj) });
  return state;
};
`;

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

test.serial('read a top level path', async (t) => {
  const state = { ready: true };

  const result = await execute(`assert($.ready)`, state);
  t.falsy(result.errors);

  const failed = await execute(`assert(!$.ready)`, state);
  t.is(failed.errors.src.message, 'assertion statement failed with false');
});

test.serial('read a nested path', async (t) => {
  const state = { data: { patient: { name: 'Alice' } } };
  const job = `assert($.data.patient.name === 'Alice')`;

  const result = await execute(job, state);
  t.falsy(result.errors);
});

test.serial('read an array index', async (t) => {
  const state = { data: { items: [{ id: 'first' }, { id: 'second' }] } };
  const job = `assert($.data.items[1].id === 'second')`;

  const result = await execute(job, state);
  t.falsy(result.errors);
});

test.serial('read a missing path with optional chaining', async (t) => {
  const state = { data: {} };
  const job = `assert($.data.missing?.id === undefined)`;

  const result = await execute(job, state);
  t.falsy(result.errors);
});

test.serial('use lazy-state in arithmetic', async (t) => {
  const state = { report: { revenue: 100, expenses: 40 } };
  const job = `assert($.report.revenue - $.report.expenses === 60)`;

  const result = await execute(job, state);
  t.falsy(result.errors);
});

test.serial('use lazy-state in logical expressions', async (t) => {
  const state = { a: true, b: false };
  const job = `assert($.a && !$.b)
assert($.b || $.a)`;

  const result = await execute(job, state);
  t.falsy(result.errors);
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
