import test from 'ava';
import { setupProject } from './helpers';

import describeProject from '../src/describe-project';

let members;

// Load the fixture once and then run a bunch of tests against it
test.before(async () => {
  const project = await setupProject('stroopwafel');
  members = await describeProject(project);
});

const get = (name) => members.find((fn) => fn.name === name);

test('List all the exported members', async (t) => {
  t.assert(members.length === 5);
  t.truthy(get('traditional'));
  t.truthy(get('oneFlavour'));
  t.truthy(get('manyFlavours'));
  t.truthy(get('fn'));
  t.truthy(get('flavours'));
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
});

test('Recognise a magic function', async (t) => {
  const fn = get('oneFlavour');
  t.truthy(fn);
  t.true(fn.magic);
});

test('Parse an empty file', async (t) => {
  const project = await setupProject('empty');
  const fns = await describeProject(project);
  t.is(fns.length, 0);
});

test('Recognise a namespace', async (t) => {
  const ns = get('flavours');
  t.is(ns.type, 'namespace');

  // Note that we don't do a lot with the namespace right now - we just acknowledge that its there
});
