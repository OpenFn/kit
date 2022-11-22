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

test('Load the example', async (t) => {
  const fn = get('traditional');
  t.is(fn.examples[0], 'traditional()');
  t.is(fn.parent, undefined);
});

test('Load common fn', async (t) => {
  const fn = get('fn');
  t.truthy(fn);
  t.is(fn.parent, 'language-common');
});
