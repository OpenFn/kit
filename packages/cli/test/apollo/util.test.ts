import test from 'ava';

import {
  getURL,
  LOCAL_URL,
  PRODUCTION_URL,
  STAGING_URL,
} from '../../src/apollo/util';

test.beforeEach(() => {
  delete process.env.OPENFN_APOLLO_DEFAULT_ENV;
});

test('getUrl: use staging by default', (t) => {
  const result = getURL({});

  t.is(result, STAGING_URL);
});

test('getUrl: use default from env', (t) => {
  process.env.OPENFN_APOLLO_DEFAULT_ENV = 'local';
  const result = getURL({});

  t.is(result, LOCAL_URL);
});

test('getUrl: throw if OPENFN_APOLLO_DEFAULT_ENV has an invalid value', (t) => {
  process.env.OPENFN_APOLLO_DEFAULT_ENV = 'jam';

  t.throws(() => getURL({}), {
    message: 'Unrecognised apollo URL loaded from env: jam',
  });
});

test('getUrl: use local if passed explicitly', (t) => {
  const result = getURL({
    // idk how to do this in yargs, --local needs to expand do apolloUrl=local
    apolloUrl: 'local',
  });

  t.is(result, LOCAL_URL);
});

test('getUrl: use staging if passed explicitly', (t) => {
  const result = getURL({
    apolloUrl: 'staging',
  });

  t.is(result, STAGING_URL);
});

test('getUrl: use prod if passed explicitly', (t) => {
  const result = getURL({
    apolloUrl: 'prod',
  });

  t.is(result, PRODUCTION_URL);
});

test('getUrl: use production if passed explicitly', (t) => {
  const result = getURL({
    apolloUrl: 'production',
  });

  t.is(result, PRODUCTION_URL);
});

test('getUrl: use a URL if passed explicitly', (t) => {
  const url = 'http://www.example.com';
  const result = getURL({
    apolloUrl: url,
  });

  t.is(result, url);
});

test('getUrl: throw if an unknown value is passed', (t) => {
  t.throws(
    () =>
      getURL({
        apolloUrl: 'raspberry brûlée',
      }),
    { message: 'Unrecognised apollo URL' }
  );
});

test.todo('throw if an invalid default is set');
