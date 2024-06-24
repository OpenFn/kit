import test from 'ava';
import { createMockLogger } from '@openfn/logger';
import type { ExecutionPlan, Job } from '@openfn/lexicon';

import autoinstall, {
  AutoinstallOptions,
  identifyAdaptors,
} from '../../src/api/autoinstall';
import { AUTOINSTALL_COMPLETE, AUTOINSTALL_ERROR } from '../../src/events';
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

const mockHandleInstall = async (_specifier: string): Promise<void> =>
  new Promise<void>((r) => r()).then();

const logger = createMockLogger();

const wait = (duration = 10) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration);
  });

const mockAutoinstallOpts = {
  handleInstall: mockHandleInstall,
  handleIsInstalled: mockIsInstalled,
  versionLookup: async () => '2.0.0',
};

const createContext = (
  autoinstallOpts: AutoinstallOptions = {},
  jobs?: Partial<Job>[],
  customWhitelist?: RegExp[]
) =>
  new ExecutionContext({
    state: {
      id: 'x',
      status: 'pending',
      plan: {
        workflow: {
          steps: jobs || [
            { adaptor: '@openfn/language-common@1.0.0', expression: '.' },
          ],
        },
        options: {},
      },
      input: {},
    },
    logger,
    // @ts-ignore
    callWorker: async () => {},
    options: {
      logger,
      whitelist: customWhitelist || whitelist,
      repoDir: 'tmp/repo',

      // @ts-ignore
      autoinstall: {
        ...mockAutoinstallOpts,
        ...autoinstallOpts,
      },
    },
  });

test.afterEach(() => {
  logger._reset();
});

test('Autoinstall basically works', async (t) => {
  const autoinstallOpts = {
    handleInstall: mockHandleInstall,
    handleIsInstalled: async () => false,
  };
  const context = createContext(autoinstallOpts);

  const paths = await autoinstall(context);
  t.log(paths);
  t.deepEqual(paths, {
    '@openfn/language-common@1.0.0': {
      path: 'tmp/repo/node_modules/@openfn/language-common_1.0.0',
      version: '1.0.0',
    },
  });
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
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        {
          adaptor: 'common@1.0.0',
          expression: '.',
        },
        {
          adaptor: 'common@1.0.0',
          expression: '.',
        },
        {
          adaptor: 'common@1.0.1',
          expression: '.',
        },
      ],
    },
    options: {},
  };
  const adaptors = identifyAdaptors(plan);
  t.true(adaptors.size === 2);
  t.true(adaptors.has('common@1.0.0'));
  t.true(adaptors.has('common@1.0.1'));
});

test.serial('autoinstall: handle @latest', async (t) => {
  const jobs = [
    {
      adaptor: 'x@latest',
    },
  ];

  const context = createContext({}, jobs, [/x/]);

  const result = await autoinstall(context);

  t.deepEqual(result, {
    'x@latest': {
      path: 'tmp/repo/node_modules/x_2.0.0',
      version: '2.0.0',
    },
  });
});

test.serial('autoinstall: handle @next', async (t) => {
  const jobs = [
    {
      adaptor: 'x@next',
    },
  ];

  const context = createContext({}, jobs, [/x/]);

  const result = await autoinstall(context);

  t.deepEqual(result, {
    'x@next': {
      path: 'tmp/repo/node_modules/x_2.0.0',
      version: '2.0.0',
    },
  });
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

// TODO
// error handling
// Queue for multiple installs
// Queue for multiple installs of the same version
// don't autoinstall if it's already there

test.serial(
  'autoinstall: only call install once if there are two concurrent install requests',
  async (t) => {
    let callCount = 0;

    const installed: Record<string, boolean> = {};

    const mockInstall = (name: string) =>
      new Promise<void>((resolve) => {
        installed[name] = true;
        callCount++;
        setTimeout(() => resolve(), 20);
      });

    const options = {
      skipRepoValidation: true,
      handleInstall: mockInstall,
      handleIsInstalled: async (name: string) => name in installed,
    };

    const context = createContext(options);

    await Promise.all([autoinstall(context), autoinstall(context)]);

    t.is(callCount, 1);
  }
);

test.serial('autoinstall: install in sequence', async (t) => {
  const installed: Record<string, boolean> = {};

  const states: Record<string, any> = {};

  const mockInstall = (name: string) =>
    new Promise<void>((resolve) => {
      // Each time install is called,
      // record the time the call was made
      // and the install state
      states[name] = {
        time: new Date().getTime(),
        installed: Object.keys(installed).map((s) => s.split('common@')[1]),
      };
      installed[name] = true;
      setTimeout(() => resolve(), 50);
    });

  const options = {
    skipRepoValidation: true,
    handleInstall: mockInstall,
    handleIsInstalled: false,
  } as any;

  const c1 = createContext(options, [{ adaptor: '@openfn/language-common@1' }]);
  const c2 = createContext(options, [{ adaptor: '@openfn/language-common@2' }]);
  const c3 = createContext(options, [{ adaptor: '@openfn/language-common@3' }]);

  autoinstall(c1);
  await wait(1);
  autoinstall(c2);
  await wait(1);
  await autoinstall(c3);

  const s1 = states['@openfn/language-common@1'];
  const s2 = states['@openfn/language-common@2'];
  const s3 = states['@openfn/language-common@3'];

  // Check that modules are installed in sequence
  t.deepEqual(s1.installed, []);
  t.deepEqual(s2.installed, ['1']);
  t.deepEqual(s3.installed, ['1', '2']);

  // And check for a time gap between installs
  t.true(s3.time - s2.time > 40);
  t.true(s2.time - s1.time > 40);
});

test('autoinstall: handle two seperate, non-overlapping installs', async (t) => {
  const options = {
    handleInstall: mockHandleInstall,
    handleIsInstalled: async () => false,
  };

  const c1 = createContext(options, [
    { adaptor: '@openfn/language-dhis2@1.0.0' },
  ]);
  const c2 = createContext(options, [
    { adaptor: '@openfn/language-http@1.0.0' },
  ]);

  const p1 = await autoinstall(c1);
  t.deepEqual(p1, {
    '@openfn/language-dhis2@1.0.0': {
      path: 'tmp/repo/node_modules/@openfn/language-dhis2_1.0.0',
      version: '1.0.0',
    },
  });

  const p2 = await autoinstall(c2);
  t.deepEqual(p2, {
    '@openfn/language-http@1.0.0': {
      path: 'tmp/repo/node_modules/@openfn/language-http_1.0.0',
      version: '1.0.0',
    },
  });
});

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
    '@openfn/language-common@1.0.0': {
      path: 'tmp/repo/node_modules/@openfn/language-common_1.0.0',
      version: '1.0.0',
    },
    '@openfn/language-http@1.0.0': {
      path: 'tmp/repo/node_modules/@openfn/language-http_1.0.0',
      version: '1.0.0',
    },
  });
});

test.serial('autoinstall: write linker options back to the plan', async (t) => {
  const jobs = [
    {
      adaptor: '@openfn/language-common@1.0.0',
    },
    {
      adaptor: '@openfn/language-common@2.0.0',
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

  await autoinstall(context);

  const [a, b, c] = context.state.plan.workflow.steps as Job[];
  t.deepEqual(a.linker, {
    '@openfn/language-common': {
      path: 'tmp/repo/node_modules/@openfn/language-common_1.0.0',
      version: '1.0.0',
    },
  });
  t.deepEqual(b.linker, {
    '@openfn/language-common': {
      path: 'tmp/repo/node_modules/@openfn/language-common_2.0.0',
      version: '2.0.0',
    },
  });
  t.deepEqual(c.linker, {
    '@openfn/language-http': {
      path: 'tmp/repo/node_modules/@openfn/language-http_1.0.0',
      version: '1.0.0',
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
    'y@1.0.0': {
      path: 'tmp/repo/node_modules/y_1.0.0',
      version: '1.0.0',
    },
  });
});

test.serial('autoinstall: emit an event on completion', async (t) => {
  let event: any;
  const jobs = [
    {
      adaptor: '@openfn/language-common@1.0.0',
      version: '1.0.0',
    },
  ];

  const autoinstallOpts = {
    skipRepoValidation: true,
    handleInstall: async () => new Promise((done) => setTimeout(done, 50)),
    handleIsInstalled: async () => false,
  } as any;
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

test.serial('autoinstall: throw on error', async (t) => {
  const mockIsInstalled = async () => false;
  const mockInstall = async () => {
    throw new Error('err');
  };

  const autoinstallOpts = {
    handleInstall: mockInstall,
    handleIsInstalled: mockIsInstalled,
  };
  const context = createContext(autoinstallOpts);

  await t.throwsAsync(() => autoinstall(context), {
    name: 'AutoinstallError',
    message: 'Error installing @openfn/language-common@1.0.0: err',
  });
});

test.serial('autoinstall: throw on error twice if pending', async (t) => {
  return new Promise((done) => {
    let callCount = 0;
    let errCount = 0;
    const mockIsInstalled = async () => false;
    const mockInstall = async () => {
      callCount++;
      return new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('err')), 10);
      });
    };

    const autoinstallOpts = {
      handleInstall: mockInstall,
      handleIsInstalled: mockIsInstalled,
    } as any;
    const context = createContext(autoinstallOpts);

    autoinstall(context).catch(assertCatches);

    autoinstall(context).catch(assertCatches);

    function assertCatches(e: any) {
      t.is(e.name, 'AutoinstallError');
      errCount += 1;
      if (errCount === 2) {
        t.is(callCount, 2);
        t.pass('threw twice!');
        done();
      }
    }
  });
});

test.serial('autoinstall: emit on error', async (t) => {
  let evt: any;
  const mockIsInstalled = async () => false;
  const mockInstall = async () => {
    throw new Error('err');
  };

  const autoinstallOpts = {
    handleInstall: mockInstall,
    handleIsInstalled: mockIsInstalled,
  };
  const context = createContext(autoinstallOpts);

  context.on(AUTOINSTALL_ERROR, (e) => {
    evt = e;
  });

  try {
    await autoinstall(context);
  } catch (e) {
    // do nothing
  }

  t.is(evt.module, '@openfn/language-common');
  t.is(evt.version, '1.0.0');
  t.is(evt.message, 'err');
  t.true(!isNaN(evt.duration));
});

test.serial('autoinstall: throw twice in a row', async (t) => {
  let callCount = 0;

  const mockIsInstalled = async () => false;
  const mockInstall = async () => {
    callCount++;
    return new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error('err')), 1);
    });
  };

  const autoinstallOpts = {
    handleInstall: mockInstall,
    handleIsInstalled: mockIsInstalled,
  } as any;
  const context = createContext(autoinstallOpts);

  await t.throwsAsync(() => autoinstall(context), {
    name: 'AutoinstallError',
    message: 'Error installing @openfn/language-common@1.0.0: err',
  });
  t.is(callCount, 1);

  await t.throwsAsync(() => autoinstall(context), {
    name: 'AutoinstallError',
    message: 'Error installing @openfn/language-common@1.0.0: err',
  });
  t.is(callCount, 2);
});

test('write versions to context', async (t) => {
  const autoinstallOpts = {
    handleInstall: mockHandleInstall,
    handleIsInstalled: async () => false,
  };
  const context = createContext(autoinstallOpts);

  await autoinstall(context);

  // @ts-ignore
  t.deepEqual(context.versions['@openfn/language-common'], ['1.0.0']);
});

test("write versions to context even if we don't install", async (t) => {
  const autoinstallOpts = {
    handleInstall: mockHandleInstall,
    handleIsInstalled: async () => true,
  };
  const context = createContext(autoinstallOpts);

  await autoinstall(context);

  // @ts-ignore
  t.deepEqual(context.versions['@openfn/language-common'], ['1.0.0']);
});
