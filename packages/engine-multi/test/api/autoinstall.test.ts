import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import autoinstall, { identifyAdaptors } from '../../src/api/autoinstall';
import { AUTOINSTALL_COMPLETE } from '../../src/events';
import ExecutionContext from '../../src/classes/ExecutionContext';
import whitelist from '../../src/whitelist';

type PackageJson = {
  name: string;
  [x: string]: any;
};

const mockIsInstalled = (pkg: PackageJson) => async (specifier: string) => {
  const alias = specifier.split('@').join('_');
  return pkg.dependencies.hasOwnProperty(alias);
};

const mockHandleInstall = async (specifier: string): Promise<void> =>
  new Promise<void>((r) => r()).then();

const logger = createMockLogger();

const createContext = (
  autoinstallOpts?,
  jobs?: any[],
  customWhitelist?: RegExp[]
) =>
  new ExecutionContext({
    state: {
      id: 'x',
      status: 'pending',
      options: {},
      plan: {
        jobs: jobs || [{ adaptor: '@openfn/language-common@1.0.0' }],
      },
    },
    logger,
    // @ts-ignore
    callWorker: async () => {},
    options: {
      logger,
      whitelist: customWhitelist || whitelist,
      repoDir: 'tmp/repo',
      autoinstall: autoinstallOpts || {
        handleInstall: mockHandleInstall,
        handleIsInstalled: mockIsInstalled,
      },
    },
  });

test.afterEach(() => {
  logger._reset();
});

test('mock is installed: should be installed', async (t) => {
  const isInstalled = mockIsInstalled({
    name: 'repo',
    dependencies: {
      'x_1.0.0': 'path',
    },
  });

  const result = await isInstalled('x@1.0.0');
  t.true(result);
});

test('mock is installed: should not be installed', async (t) => {
  const isInstalled = mockIsInstalled({
    name: 'repo',
    dependencies: {
      'x_1.0.0': 'path',
    },
  });

  const result = await isInstalled('x@1.0.1');
  t.false(result);
});

test('mock install: should return async', async (t) => {
  await mockHandleInstall('x@1.0.0');
  t.true(true);
});

test('identifyAdaptors: pick out adaptors and remove duplicates', (t) => {
  const plan = {
    jobs: [
      {
        adaptor: 'common@1.0.0',
      },
      {
        adaptor: 'common@1.0.0',
      },
      {
        adaptor: 'common@1.0.1',
      },
    ],
  };
  const adaptors = identifyAdaptors(plan);
  t.true(adaptors.size === 2);
  t.true(adaptors.has('common@1.0.0'));
  t.true(adaptors.has('common@1.0.1'));
});

// This doesn't do anything except check that the mocks are installed
test.serial('autoinstall: should call both mock functions', async (t) => {
  let didCallIsInstalled = false;
  let didCallInstall = true;

  const mockIsInstalled = async () => {
    didCallIsInstalled = true;
    return false;
  };
  const mockInstall = async () => {
    didCallInstall = true;
    return;
  };

  const autoinstallOpts = {
    handleInstall: mockInstall,
    handleIsInstalled: mockIsInstalled,
  };
  const context = createContext(autoinstallOpts);

  await autoinstall(context);

  t.true(didCallIsInstalled);
  t.true(didCallInstall);
});

test.serial(
  'autoinstall: only call install once if there are two concurrent install requests',
  async (t) => {
    let callCount = 0;

    const mockInstall = () =>
      new Promise<void>((resolve) => {
        callCount++;
        setTimeout(() => resolve(), 20);
      });

    const options = {
      skipRepoValidation: true,
      handleInstall: mockInstall,
      handleIsInstalled: async () => false,
    };

    const context = createContext(options);

    await Promise.all([autoinstall(context), autoinstall(context)]);

    t.is(callCount, 1);
  }
);

test.serial(
  'autoinstall: do not try to install blacklisted modules',
  async (t) => {
    let callCount = 0;

    const mockInstall = () =>
      new Promise<void>((resolve) => {
        callCount++;
        setTimeout(() => resolve(), 20);
      });

    const job = [
      {
        adaptor: 'lodash@1.0.0',
      },
    ];

    const options = {
      skipRepoValidation: true,
      handleInstall: mockInstall,
      handleIsInstalled: async () => false,
    };

    const context = createContext(options, job);

    await autoinstall(context);

    t.is(callCount, 0);
  }
);

test.serial('autoinstall: return a map to modules', async (t) => {
  const jobs = [
    {
      adaptor: '@openfn/language-common@1.0.0',
    },
    {
      adaptor: '@openfn/language-http@1.0.0',
    },
  ];

  const autoinstallOpts = {
    skipRepoValidation: true,
    handleInstall: async () => {},
    handleIsInstalled: async () => false,
  };
  const context = createContext(autoinstallOpts, jobs);

  const result = await autoinstall(context);

  t.deepEqual(result, {
    '@openfn/language-common': {
      path: 'tmp/repo/node_modules/@openfn/language-common_1.0.0',
    },
    '@openfn/language-http': {
      path: 'tmp/repo/node_modules/@openfn/language-http_1.0.0',
    },
  });
});

test.serial('autoinstall: support custom whitelist', async (t) => {
  const whitelist = [/^y/];
  const jobs = [
    {
      // will be ignored
      adaptor: 'x@1.0.0',
    },
    {
      // will be installed
      adaptor: 'y@1.0.0',
    },
  ];

  const autoinstallOpts = {
    skipRepoValidation: true,
    handleInstall: async () => {},
    handleIsInstalled: async () => false,
  };
  const context = createContext(autoinstallOpts, jobs, whitelist);

  const result = await autoinstall(context);

  t.deepEqual(result, {
    y: {
      path: 'tmp/repo/node_modules/y_1.0.0',
    },
  });
});

test.serial('autoinstall: emit an event on completion', async (t) => {
  let event;
  const jobs = [
    {
      adaptor: '@openfn/language-common@1.0.0',
    },
  ];

  const autoinstallOpts = {
    skipRepoValidation: true,
    handleInstall: async () => new Promise((done) => setTimeout(done, 50)),
    handleIsInstalled: async () => false,
  };
  const context = createContext(autoinstallOpts, jobs);

  context.on(AUTOINSTALL_COMPLETE, (evt) => {
    event = evt;
  });

  await autoinstall(context);

  t.truthy(event);
  t.is(event.module, '@openfn/language-common');
  t.is(event.version, '1.0.0');
  // Duration could be anything really as timeout is only loose - but so long as it's
  // more than 10ms that implies it's called handleInstall and returned a reasonable value
  t.assert(event.duration >= 10);
});

test.todo('autoinstall: emit on error');
