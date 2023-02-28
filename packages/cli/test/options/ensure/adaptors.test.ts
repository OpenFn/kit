import test from 'ava';
import { adaptors, Opts } from '../../../src/options';

test('ensure should create an empty adaptors object', (t) => {
  const opts = {} as Opts;
  adaptors.ensure!(opts);

  t.assert(Array.isArray(opts.adaptors));
  t.assert(opts.adaptors!.length === 0);
});

test('should create an empty adaptors object if undefined', (t) => {
  const opts = {
    adaptors: undefined,
    expandAdaptors: true,
  } as Opts;

  adaptors.ensure!(opts);

  t.assert(Array.isArray(opts.adaptors));
  t.assert(opts.adaptors!.length === 0);
});

test('ensure should accept a valid longform value', (t) => {
  const initialValue = ['@openfn/language-http'];
  const opts = {
    adaptors: initialValue,
    expandAdaptors: true,
  } as Opts;

  adaptors.ensure!(opts);

  t.assert(Array.isArray(opts.adaptors));
  t.deepEqual(opts.adaptors, initialValue);
});

test('ensure should accept and expand a valid shortform value', (t) => {
  // @ts-ignore types are a bit inconsistent right now
  const opts = {
    adaptors: 'http',
    expandAdaptors: true,
  } as Opts;

  adaptors.ensure!(opts);

  t.assert(Array.isArray(opts.adaptors));
  t.deepEqual(opts.adaptors, ['@openfn/language-http']);
});

test('ensure should not expand a shortform value of expandAdaptors is false', (t) => {
  // @ts-ignore types are a bit inconsistent right now
  const opts = {
    adaptors: 'http',
    expandAdaptors: false,
  } as Opts;

  adaptors.ensure!(opts);

  t.assert(Array.isArray(opts.adaptors));
  t.deepEqual(opts.adaptors, ['http']);
});

test('ensure should accept a valid longform value with a path', (t) => {
  const initialValue = ['@openfn/language-http=/repo/adaptors/http'];
  const opts = {
    adaptors: initialValue,
    expandAdaptors: true,
  } as Opts;

  adaptors.ensure!(opts);

  t.assert(Array.isArray(opts.adaptors));
  t.deepEqual(opts.adaptors, initialValue);
});

test('ensure should accept a valid shortform value with a path', (t) => {
  const opts = {
    adaptors: ['http=/repo/adaptors/http'],
    expandAdaptors: true,
  } as Opts;

  adaptors.ensure!(opts);

  t.assert(Array.isArray(opts.adaptors));
  t.deepEqual(opts.adaptors, ['@openfn/language-http=/repo/adaptors/http']);
});

test('ensure should remove aliased options', (t) => {
  const opts = {
    adaptors: ['http'],
    expandAdaptors: true,
  } as Opts;

  adaptors.ensure!(opts);

  // @ts-ignore
  t.falsy(opts.a);
  t.falsy(opts.adaptor);
});
