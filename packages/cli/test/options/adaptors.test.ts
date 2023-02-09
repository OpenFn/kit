import test from 'ava';
import { adaptors } from '../../src/options';
import { Opts } from '../../src/commands';

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

test('ensure should remove aliased options', (t) => {
  const opts = {
    adaptors: ['http'],
  } as Opts;

  adaptors.ensure(opts);

  // @ts-ignore
  t.falsy(opts.a);
  t.falsy(opts.adaptor);
});

