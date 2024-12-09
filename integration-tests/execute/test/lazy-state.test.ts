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
