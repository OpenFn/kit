import test from 'ava';
import cache from '../../src/metadata/cache';

const eg = {
  adaptor: 'common@1.0.0',
  config: {
    password: 'password123',
    user: 'admin',
  },
};

let defaultKey = '';

test.before(() => {
  defaultKey = cache.generateKey(eg.config, eg.adaptor);
});

test('generate a hash for default config', (t) => {
  const hash = cache.generateKey(eg.config, eg.adaptor);
  t.is(hash, defaultKey);
});

test('generate a hash for bad input', (t) => {
  // @ts-ignore
  const hash = cache.generateKey({}, undefined, undefined);
  t.false(hash === defaultKey);
  t.notRegex(hash, /undefined/);
  t.is(hash.length, defaultKey.length);
});

test('generate a different hash for different config', (t) => {
  const hash = cache.generateKey(
    {
      user: 'x',
      password: 'y',
    },
    eg.adaptor
  );
  t.false(hash === defaultKey);
  t.notRegex(hash, /user/);
  t.notRegex(hash, /password/);
  t.is(hash.length, defaultKey.length);
});

test('generate a different hash for different adaptor', (t) => {
  const hash = cache.generateKey(eg.config, 'http');
  t.false(hash === defaultKey);
  t.notRegex(hash, /user/);
  t.notRegex(hash, /password/);
  t.is(hash.length, defaultKey.length);
});

test('generate a different hash for different adaptor version', (t) => {
  const hash = cache.generateKey(eg.config, 'common@99');
  t.false(hash === defaultKey);
  t.notRegex(hash, /user/);
  t.notRegex(hash, /password/);
  t.is(hash.length, defaultKey.length);
});

test('generate a different hash for an adaptor with a path', (t) => {
  const hash = cache.generateKey(eg.config, 'common=a/b/c');
  t.false(hash === defaultKey);
  t.notRegex(hash, /user/);
  t.notRegex(hash, /password/);
  t.is(hash.length, defaultKey.length);
});

test('generate the same for keys in a different order', (t) => {
  const config = {
    user: 'admin',
    password: 'password123',
  };
  const hash = cache.generateKey(config, eg.adaptor);
  t.is(hash, defaultKey);
});

test('generate the same for deep keys in a different order', (t) => {
  const config = {
    x: {
      y: {
        a: 'a',
        b: 'b',
        c: 'c',
      },
    },
  };
  const hash1 = cache.generateKey(config, eg.adaptor);

  const config2 = {
    x: {
      y: {
        b: 'b',
        a: 'a',
        c: 'c',
      },
    },
  };
  const hash2 = cache.generateKey(config2, eg.adaptor);

  t.is(hash1, hash2);
});

// We don't sort arrays within the config
test('generate a different hash for different array order', (t) => {
  const config1 = {
    arr: ['a', 'b'],
  };
  const config2 = {
    arr: ['b', 'a'],
  };

  const hash1 = cache.generateKey(config1, eg.adaptor);
  const hash2 = cache.generateKey(config2, eg.adaptor);

  t.false(hash1 === hash2);
});
