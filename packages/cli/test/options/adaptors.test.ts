import test from 'ava';
import { adaptors as adaptorsOption } from '../../src/options';
import { Opts } from '../../src/commands';

const adaptors = adaptorsOption();

test('ensure should create an empty adaptors object', (t) => {
  const opts = {} as Opts;
  adaptors.ensure(opts);

  t.assert(Array.isArray(opts.adaptors))
  t.assert(opts.adaptors!.length === 0);
});

test('should create an empty adaptors object if undefined', (t) => {
  const opts = {
    adaptors: undefined,
  } as Opts;

  adaptors.ensure(opts);

  t.assert(Array.isArray(opts.adaptors))
  t.assert(opts.adaptors!.length === 0);
});

// test('should dumbly ensure an array', (t) => {
//   const stringValue = adaptors.ensure({ adaptors: 'a'});
//   t.deepEqual(stringValue.adaptors, ['a']);

//   const numberValue = adaptors.ensure({ adaptors: 1});
//   t.deepEqual(numberValue.adaptors, [1]);

//   const boolValue = adaptors.ensure({ adaptors: true });
//   t.deepEqual(boolValue.adaptors, [true]);

//   // Note: this will not create an array. But I don't think we care.
//   const falseValue = adaptors.ensure({ adaptors: false });
//   t.deepEqual(falseValue.adaptors, false);
// });

test('ensure should accept a valid longform value', (t) => {
  const initialValue = ['@openfn/language-http']
  const opts = {
    adaptors: initialValue,
  } as Opts;

  adaptors.ensure(opts);

  t.assert(Array.isArray(opts.adaptors))
  t.deepEqual(opts.adaptors, initialValue);
});

test('ensure should accept and expand a valid shortform value', (t) => {
  // @ts-ignore types are a bit inconsistent right now
  const opts = {
    adaptors: 'http', 
  } as Opts;

  adaptors.ensure(opts);

  t.assert(Array.isArray(opts.adaptors))
  t.deepEqual(opts.adaptors, ['@openfn/language-http']);
});

test('ensure should accept a valid longform value with a path', (t) => {
  const initialValue = ['@openfn/language-http=/repo/adaptors/http']
  const opts = {
    adaptors: initialValue,
  } as Opts;

  adaptors.ensure(opts);

  t.assert(Array.isArray(opts.adaptors))
  t.deepEqual(opts.adaptors, initialValue);
});

test('ensure should accept a valid shortform value with a path', (t) => {
  const opts = {
    adaptors: ['http=/repo/adaptors/http'],
  } as Opts;

  adaptors.ensure(opts);

  t.assert(Array.isArray(opts.adaptors))
  t.deepEqual(opts.adaptors, ['@openfn/language-http=/repo/adaptors/http']);
});

