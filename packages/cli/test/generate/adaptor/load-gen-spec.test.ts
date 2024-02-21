import test from 'ava';
import { mockFs, resetMockFs } from '../../util';
import loadGenSpec from '../../../src/generate/adaptor/load-gen-spec';
import { createMockLogger } from '@openfn/logger';

const logger = createMockLogger();

test.after(resetMockFs);

test.serial('should load a spec from a json file', async (t) => {
  const spec = {
    adaptor: 'a',
    spec: {},
    instruction: 'abc',
  };

  // Note that this takes like 4 seconds to initialise?!
  mockFs({
    'spec.json': JSON.stringify(spec),
  });

  const options = {
    path: 'spec.json',
  };

  const result = await loadGenSpec(options, logger);

  t.deepEqual(result, spec);
});

test.serial(
  'should load a spec from a json file with overriden name',
  async (t) => {
    const spec = {
      adaptor: 'a',
      spec: {},
      instruction: 'abc',
    };

    mockFs({
      'spec.json': JSON.stringify(spec),
    });

    const options = {
      path: 'spec.json',
      adaptor: 'b',
    };

    const result = await loadGenSpec(options, logger);

    t.deepEqual(result, {
      ...spec,
      adaptor: 'b',
    });
  }
);

test.serial(
  'should load a spec from a json file with overridden api spec',
  async (t) => {
    const api = { x: 1 };

    const spec = {
      adaptor: 'a',
      spec: {},
      instruction: 'abc',
    };

    mockFs({
      'spec.json': JSON.stringify(spec),
    });

    const options = {
      path: 'spec.json',
      spec: api,
    };

    // @ts-ignore options typing
    const result = await loadGenSpec(options, logger);

    t.deepEqual(result, {
      ...spec,
      spec: api,
    });
  }
);

test.serial('should load an api spec from a path', async (t) => {
  const api = { x: 1 };

  const spec = {
    adaptor: 'a',
    spec: 'api.json',
    instruction: 'abc',
  };

  mockFs({
    'spec.json': JSON.stringify(spec),
    'api.json': JSON.stringify(api),
  });

  const options = {
    path: 'spec.json',
  };

  const result = await loadGenSpec(options, logger);

  t.deepEqual(result, {
    ...spec,
    spec: api,
  });
});

test.serial('should load an api spec from a path override', async (t) => {
  const api = { x: 1 };

  const spec = {
    adaptor: 'a',
    spec: {},
    instruction: 'abc',
  };

  mockFs({
    'spec.json': JSON.stringify(spec),
    'api.json': JSON.stringify(api),
  });

  const options = {
    path: 'spec.json',
    spec: 'api.json',
  };

  const result = await loadGenSpec(options, logger);

  t.deepEqual(result, {
    ...spec,
    spec: api,
  });
});

test.serial('should generate a default name from the API spec', async (t) => {
  const spec = {
    spec: {
      info: {
        title: 'my Friendly API',
      },
    },
    instruction: 'abc',
  };

  mockFs({
    'spec.json': JSON.stringify(spec),
  });

  const options = {
    path: 'spec.json',
  };

  const result = await loadGenSpec(options, logger);

  t.deepEqual(result, {
    ...spec,
    adaptor: 'my-friendly-api',
  });
});

test.serial('should load an API spec CLI path and name', async (t) => {
  const api = { x: 1 };

  mockFs({
    'api.json': JSON.stringify(api),
  });

  const options = {
    spec: 'api.json',
    adaptor: 'a',
  };

  const result = await loadGenSpec(options, logger);

  t.deepEqual(result, {
    adaptor: 'a',
    spec: api,
  });
});
