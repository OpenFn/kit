import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import {
  getURL,
  LOCAL_URL,
  PRODUCTION_URL,
  STAGING_URL,
  outputFiles,
} from '../../src/apollo/util';
import { ApolloOptions } from '../../src/apollo/command';

test.beforeEach(() => {
  delete process.env.OPENFN_APOLLO_DEFAULT_ENV;
});

test('getUrl: use staging by default', (t) => {
  const result = getURL({} as ApolloOptions);

  t.is(result, STAGING_URL);
});

test('getUrl: use default from env', (t) => {
  process.env.OPENFN_APOLLO_DEFAULT_ENV = 'local';
  const result = getURL({} as ApolloOptions);

  t.is(result, LOCAL_URL);
});

test('getUrl: throw if OPENFN_APOLLO_DEFAULT_ENV has an invalid value', (t) => {
  process.env.OPENFN_APOLLO_DEFAULT_ENV = 'jam';

  t.throws(() => getURL({} as ApolloOptions), {
    message: 'Unrecognised apollo URL loaded from env: jam',
  });
});

test('getUrl: use local if passed explicitly', (t) => {
  const result = getURL({
    // idk how to do this in yargs, --local needs to expand do apolloUrl=local
    apolloUrl: 'local',
  } as ApolloOptions);

  t.is(result, LOCAL_URL);
});

test('getUrl: use staging if passed explicitly', (t) => {
  const result = getURL({
    apolloUrl: 'staging',
  } as ApolloOptions);

  t.is(result, STAGING_URL);
});

test('getUrl: use prod if passed explicitly', (t) => {
  const result = getURL({
    apolloUrl: 'prod',
  } as ApolloOptions);

  t.is(result, PRODUCTION_URL);
});

test('getUrl: use production if passed explicitly', (t) => {
  const result = getURL({
    apolloUrl: 'production',
  } as ApolloOptions);

  t.is(result, PRODUCTION_URL);
});

test('getUrl: use a URL if passed explicitly', (t) => {
  const url = 'http://www.example.com';
  const result = getURL({
    apolloUrl: url,
  } as ApolloOptions);

  t.is(result, url);
});

test('getUrl: throw if an unknown value is passed', (t) => {
  t.throws(
    () =>
      getURL({
        apolloUrl: 'raspberry brûlée',
      } as ApolloOptions),
    { message: 'Unrecognised apollo URL' }
  );
});

test('outputFiles: log several files', (t) => {
  const files = {
    'tmp/index.js': '// here is a js file ',
    'tmp/readme.md': `### readme

here is a plan text file`,
  };

  const logger = createMockLogger();

  outputFiles(files, logger);

  const output = `
-------------
tmp/index.js
-------------

// here is a js file 


--------------
tmp/readme.md
--------------

### readme

here is a plan text file

`;

  const resultStr = logger._history.map((h) => h[1] ?? '').join('\n');

  t.is(output, resultStr);
});
