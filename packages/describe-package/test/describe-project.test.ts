import test from 'ava';
import { setupProject } from './helpers';

import describeProject from '../src/describe-project';

let fns;

// Load the fixture once and then run a bunch of tests against it
test.before(async () => {
  const project = await setupProject('stroopwafel');
  fns = await describeProject(project);
});

const get = (name) => fns.find((fn) => fn.name === name);

test('List all the exported functions', async (t) => {
  t.assert(fns.length === 4);
  t.truthy(get('traditional'));
  t.truthy(get('oneFlavour'));
  t.truthy(get('manyFlavours'));
  t.truthy(get('fn'));
});

test('Does not include private functions', async (t) => {
  const priv = get('somethingPrivate');
  t.falsy(priv);
});

test('No parameters in a 0-arity function', async (t) => {
  const trad = get('traditional');
  t.is(trad.parameters.length, 0);
});

test('1 parameters in a 1-arity function', async (t) => {
  const fn = get('oneFlavour');
  t.is(fn.parameters.length, 1);
  const [flavour] = fn.parameters;
  t.is(flavour.name, 'flavour');
  t.is(flavour.type, 'string');
});

test('Load an example', async (t) => {
  const fn = get('traditional');
  const [{ code }] = fn.examples;
  t.is(code, 'traditional()');
  t.is(fn.parent, undefined);
});

test('Load an example with caption', async (t) => {
  const fn = get('oneFlavour');
  const [{ code, caption }] = fn.examples;
  t.is(code, "oneFlavour('falafel')");
  t.is(caption, 'cap');
});

test('Load common fn', async (t) => {
  const fn = get('fn');
  t.truthy(fn);
  t.is(fn.parent, 'language-common');
});

test('Recognise a magic function', async (t) => {
  const fn = get('oneFlavour');
  t.truthy(fn);
  t.true(fn.magic);
});
