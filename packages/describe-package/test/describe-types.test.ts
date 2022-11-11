import test from 'ava';
import { setupProject } from './helpers';

// TODO haven't got the semantics right yet
import describeFunctions from '../src/describe-project';

let fns;

// Load the fixture once and then run a bunch of tests against it
test.before(async () => {
  const project = await setupProject('types');
  fns = await describeFunctions(project);
});

const get = (name) => fns.find((fn) => fn.name === name);
test('string parameter', async (t) => {
  const fn = get('_string');
  const [p] = fn.parameters;
  t.is(p.type, 'string');
});

test('number parameter', async (t) => {
  const fn = get('_number');
  const [p] = fn.parameters;
  t.is(p.type, 'number');
});

test('boolean parameter', async (t) => {
  const fn = get('_boolean');
  const [p] = fn.parameters;
  t.is(p.type, 'boolean');
});

test('null parameter', async (t) => {
  const fn = get('_null');
  const [p] = fn.parameters;
  t.is(p.type, 'null');
});

test('string or number parameter', async (t) => {
  const fn = get('_stringOrNumber');
  const [p] = fn.parameters;
  // TODO in docs I want to say "string or number"
  // Is that a job for here, or for another component?
  t.is(p.type, 'string | number');
});

// This one doesnt work
// But again, I want to say "array of strings" here
test.skip('array of strings parameter', async (t) => {
  const fn = get('_stringArray');
  const [p] = fn.parameters;
  t.is(p.type, 'string[]');
});
