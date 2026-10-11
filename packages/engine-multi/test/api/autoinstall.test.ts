import test from 'ava';
import { createMockLogger } from '@openfn/logger';
import type { ExecutionPlan, Job } from '@openfn/runtime';

import path from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';

import {
  AutoinstallOptions,
  identifyAdaptors,
  isInstalled,
} from '../../src/api/autoinstall';
import { AUTOINSTALL_COMPLETE, AUTOINSTALL_ERROR } from '../../src/events';
import ExecutionContext from '../../src/classes/ExecutionContext';
import whitelist from '../../src/whitelist';
import {
  createTmpRepo,
  removeTmpRepo,
  markInstalled,
  loadAutoinstall,
  createInstallStub,
} from '../util/autoinstall-helpers';

const logger = createMockLogger();

const wait = (duration = 10) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration);
  });

// Build an ExecutionContext for a freshly-loaded autoinstall module. repoDir
// must already exist on disk because the real isInstalled / install code paths
// read and write to it.
const createContext = (
  repoDir: string,
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
            { adaptors: ['@openfn/language-common@1.0.0'], expression: '.' },
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
      repoDir,
      // @ts-ignore
      autoinstall: {
        skipRepoValidation: true,
        lockRepo: false,
        versionLookup: async () => '2.0.0',
        ...autoinstallOpts,
      },
    },
  });

test.afterEach(() => {
  logger._reset();
});

test.serial('Autoinstall basically works', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    const stub = createInstallStub({ seedOnInstall: true });
    const mod = await loadAutoinstall(stub.fn);
    const context = createContext(repoDir);

    const paths = await mod.default(context);
    t.deepEqual(paths, {
      '@openfn/language-common@1.0.0': {
        path: `${repoDir}/node_modules/@openfn/language-common_1.0.0`,
        version: '1.0.0',
      },
    });
    t.is(stub.calls.length, 1);
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test('identifyAdaptors: pick out adaptors and remove duplicates', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        {
          adaptors: ['common@1.0.0'],
          expression: '.',
        },
        {
          adaptors: ['common@1.0.0'],
          expression: '.',
        },
        {
          adaptors: ['common@1.0.1'],
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
  const repoDir = await createTmpRepo();
  try {
    const stub = createInstallStub({ seedOnInstall: true });
    const mod = await loadAutoinstall(stub.fn);
    const jobs = [{ adaptors: ['x@latest'] }];
    const context = createContext(repoDir, {}, jobs, [/x/]);

    const result = await mod.default(context);

    t.deepEqual(result, {
      'x@latest': {
        path: `${repoDir}/node_modules/x_2.0.0`,
        version: '2.0.0',
      },
    });
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test.serial('autoinstall: handle @next', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    const stub = createInstallStub({ seedOnInstall: true });
    const mod = await loadAutoinstall(stub.fn);
    const jobs = [{ adaptors: ['x@next'] }];
    const context = createContext(repoDir, {}, jobs, [/x/]);

    const result = await mod.default(context);

    t.deepEqual(result, {
      'x@next': {
        path: `${repoDir}/node_modules/x_2.0.0`,
        version: '2.0.0',
      },
    });
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test.serial('autoinstall: install is invoked exactly once per adaptor', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    const stub = createInstallStub({ seedOnInstall: true });
    const mod = await loadAutoinstall(stub.fn);
    const context = createContext(repoDir);

    await mod.default(context);

    t.is(stub.calls.length, 1);
    t.is(stub.calls[0], '@openfn/language-common@1.0.0');
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test.serial(
  'autoinstall: only call install once if there are two concurrent install requests',
  async (t) => {
    const repoDir = await createTmpRepo();
    try {
      const stub = createInstallStub({ seedOnInstall: true, delayMs: 20 });
      const mod = await loadAutoinstall(stub.fn);
      const c1 = createContext(repoDir);
      const c2 = createContext(repoDir);

      await Promise.all([mod.default(c1), mod.default(c2)]);

      t.is(stub.calls.length, 1);
    } finally {
      await removeTmpRepo(repoDir);
    }
  }
);

test.serial('autoinstall: install in sequence', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    const states: Record<string, any> = {};
    const installed: string[] = [];
    const stub = createInstallStub({
      seedOnInstall: true,
      delayMs: 50,
      onCall: (name) => {
        states[name] = {
          time: Date.now(),
          installed: [...installed].map((s) => s.split('common@')[1]),
        };
        installed.push(name);
      },
    });
    const mod = await loadAutoinstall(stub.fn);

    const c1 = createContext(repoDir, {}, [
      { adaptors: ['@openfn/language-common@1'] },
    ]);
    const c2 = createContext(repoDir, {}, [
      { adaptors: ['@openfn/language-common@2'] },
    ]);
    const c3 = createContext(repoDir, {}, [
      { adaptors: ['@openfn/language-common@3'] },
    ]);

    mod.default(c1);
    await wait(1);
    mod.default(c2);
    await wait(1);
    await mod.default(c3);

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
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test('autoinstall: handle two seperate, non-overlapping installs', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    const stub = createInstallStub({ seedOnInstall: true });
    const mod = await loadAutoinstall(stub.fn);

    const c1 = createContext(repoDir, {}, [
      { adaptors: ['@openfn/language-dhis2@1.0.0'] },
    ]);
    const c2 = createContext(repoDir, {}, [
      { adaptors: ['@openfn/language-http@1.0.0'] },
    ]);

    const p1 = await mod.default(c1);
    t.deepEqual(p1, {
      '@openfn/language-dhis2@1.0.0': {
        path: `${repoDir}/node_modules/@openfn/language-dhis2_1.0.0`,
        version: '1.0.0',
      },
    });

    const p2 = await mod.default(c2);
    t.deepEqual(p2, {
      '@openfn/language-http@1.0.0': {
        path: `${repoDir}/node_modules/@openfn/language-http_1.0.0`,
        version: '1.0.0',
      },
    });
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test.serial(
  'autoinstall: do not try to install blacklisted modules',
  async (t) => {
    const repoDir = await createTmpRepo();
    try {
      const stub = createInstallStub({ seedOnInstall: true });
      const mod = await loadAutoinstall(stub.fn);

      const job = [{ adaptors: ['lodash@1.0.0'] }];
      const context = createContext(repoDir, {}, job);

      await mod.default(context);

      t.is(stub.calls.length, 0);
    } finally {
      await removeTmpRepo(repoDir);
    }
  }
);

test.serial('autoinstall: return a map to modules', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    const stub = createInstallStub({ seedOnInstall: true });
    const mod = await loadAutoinstall(stub.fn);

    const jobs = [
      { adaptors: ['@openfn/language-common@1.0.0'] },
      { adaptors: ['@openfn/language-http@1.0.0'] },
    ];
    const context = createContext(repoDir, {}, jobs);

    const result = await mod.default(context);

    t.deepEqual(result, {
      '@openfn/language-common@1.0.0': {
        path: `${repoDir}/node_modules/@openfn/language-common_1.0.0`,
        version: '1.0.0',
      },
      '@openfn/language-http@1.0.0': {
        path: `${repoDir}/node_modules/@openfn/language-http_1.0.0`,
        version: '1.0.0',
      },
    });
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test.serial('autoinstall: write linker options back to the plan', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    const stub = createInstallStub({ seedOnInstall: true });
    const mod = await loadAutoinstall(stub.fn);

    const jobs = [
      { adaptors: ['@openfn/language-common@1.0.0'] },
      {
        adaptors: [
          '@openfn/language-common@2.0.0',
          '@openfn/language-collections@1.0.0',
        ],
      },
      { adaptors: ['@openfn/language-http@1.0.0'] },
    ];
    const context = createContext(repoDir, {}, jobs);

    await mod.default(context);

    const [a, b, c] = context.state.plan.workflow.steps as Job[];
    t.deepEqual(a.linker, {
      '@openfn/language-common': {
        path: `${repoDir}/node_modules/@openfn/language-common_1.0.0`,
        version: '1.0.0',
      },
    });
    t.deepEqual(b.linker, {
      '@openfn/language-common': {
        path: `${repoDir}/node_modules/@openfn/language-common_2.0.0`,
        version: '2.0.0',
      },
      '@openfn/language-collections': {
        path: `${repoDir}/node_modules/@openfn/language-collections_1.0.0`,
        version: '1.0.0',
      },
    });
    t.deepEqual(c.linker, {
      '@openfn/language-http': {
        path: `${repoDir}/node_modules/@openfn/language-http_1.0.0`,
        version: '1.0.0',
      },
    });
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test.serial('autoinstall: support custom whitelist', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    const stub = createInstallStub({ seedOnInstall: true });
    const mod = await loadAutoinstall(stub.fn);

    const customWhitelist = [/^y/];
    const jobs = [
      // will be ignored
      { adaptors: ['x@1.0.0'] },
      // will be installed
      { adaptors: ['y@1.0.0'] },
    ];
    const context = createContext(repoDir, {}, jobs, customWhitelist);

    const result = await mod.default(context);

    t.deepEqual(result, {
      'y@1.0.0': {
        path: `${repoDir}/node_modules/y_1.0.0`,
        version: '1.0.0',
      },
    });
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test.serial('autoinstall: emit an event on completion', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    let event: any;
    const stub = createInstallStub({ seedOnInstall: true, delayMs: 50 });
    const mod = await loadAutoinstall(stub.fn);

    const jobs = [
      { adaptors: ['@openfn/language-common@1.0.0'], version: '1.0.0' },
    ];
    const context = createContext(repoDir, {}, jobs);

    context.on(AUTOINSTALL_COMPLETE, (evt) => {
      event = evt;
    });

    await mod.default(context);

    t.truthy(event);
    t.is(event.module, '@openfn/language-common');
    t.is(event.version, '1.0.0');
    t.assert(event.duration >= 10);
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test.serial('autoinstall: throw on error', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    const stub = createInstallStub({ throws: new Error('err') });
    const mod = await loadAutoinstall(stub.fn);
    const context = createContext(repoDir);

    await t.throwsAsync(() => mod.default(context), {
      name: 'AutoinstallError',
      message: 'Error installing @openfn/language-common@1.0.0: err',
    });
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test.serial('autoinstall: throw on error twice if pending', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    return await new Promise<void>(async (done) => {
      let callCount = 0;
      let errCount = 0;
      const stub = createInstallStub({
        delayMs: 10,
        onCall: () => {
          callCount++;
        },
        throws: () => new Error('err'),
      });
      const mod = await loadAutoinstall(stub.fn);
      const context = createContext(repoDir);

      mod.default(context).catch(assertCatches);
      mod.default(context).catch(assertCatches);

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
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test.serial('autoinstall: emit on error', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    let evt: any;
    const stub = createInstallStub({ throws: new Error('err') });
    const mod = await loadAutoinstall(stub.fn);
    const context = createContext(repoDir);

    context.on(AUTOINSTALL_ERROR, (e) => {
      evt = e;
    });

    try {
      await mod.default(context);
    } catch (e) {
      // do nothing
    }

    t.is(evt.module, '@openfn/language-common');
    t.is(evt.version, '1.0.0');
    t.is(evt.message, 'err');
    t.true(!isNaN(evt.duration));
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test.serial('autoinstall: throw twice in a row', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    let callCount = 0;
    const stub = createInstallStub({
      delayMs: 1,
      onCall: () => {
        callCount++;
      },
      throws: () => new Error('err'),
    });
    const mod = await loadAutoinstall(stub.fn);
    const context = createContext(repoDir);

    await t.throwsAsync(() => mod.default(context), {
      name: 'AutoinstallError',
      message: 'Error installing @openfn/language-common@1.0.0: err',
    });
    t.is(callCount, 1);

    await t.throwsAsync(() => mod.default(context), {
      name: 'AutoinstallError',
      message: 'Error installing @openfn/language-common@1.0.0: err',
    });
    t.is(callCount, 2);
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test.serial('write versions to context', async (t) => {
  const repoDir = await createTmpRepo();
  try {
    const stub = createInstallStub({ seedOnInstall: true });
    const mod = await loadAutoinstall(stub.fn);
    const context = createContext(repoDir);

    await mod.default(context);

    // @ts-ignore
    t.deepEqual(context.versions['@openfn/language-common'], ['1.0.0']);
  } finally {
    await removeTmpRepo(repoDir);
  }
});

test.serial(
  "write versions to context even if we don't install",
  async (t) => {
    const repoDir = await createTmpRepo();
    try {
      // Pre-seed installed state so isInstalled returns true and install is skipped.
      await markInstalled(repoDir, '@openfn/language-common@1.0.0');
      const stub = createInstallStub();
      const mod = await loadAutoinstall(stub.fn);
      const context = createContext(repoDir);

      await mod.default(context);

      t.is(stub.calls.length, 0);
      // @ts-ignore
      t.deepEqual(context.versions['@openfn/language-common'], ['1.0.0']);
    } finally {
      await removeTmpRepo(repoDir);
    }
  }
);

// ---- strengthened isInstalled: also checks node_modules/<alias>/package.json ----

const SPECIFIER = '@openfn/language-http@6.5.0';
const ALIAS = '@openfn/language-http_6.5.0';

const writeRepoPkg = async (dir: string, deps: Record<string, string>) => {
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'repo', dependencies: deps })
  );
};

const seedNodeModule = async (dir: string, alias = ALIAS) => {
  const modDir = path.join(dir, 'node_modules', alias);
  await mkdir(modDir, { recursive: true });
  await writeFile(path.join(modDir, 'package.json'), '{}');
};

test.serial(
  'isInstalled returns false when alias is in repo deps but node_modules pkg is missing',
  async (t) => {
    const dir = await createTmpRepo();
    try {
      await writeRepoPkg(dir, { [ALIAS]: '6.5.0' });
      const result = await isInstalled(SPECIFIER, dir, logger);
      t.false(result as boolean);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
);

test.serial(
  'isInstalled returns true when alias is in deps AND node_modules pkg exists',
  async (t) => {
    const dir = await createTmpRepo();
    try {
      await writeRepoPkg(dir, { [ALIAS]: '6.5.0' });
      await seedNodeModule(dir);
      const result = await isInstalled(SPECIFIER, dir, logger);
      t.true(result as boolean);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
);

test.serial(
  'isInstalled returns false when alias is not in repo deps',
  async (t) => {
    const dir = await createTmpRepo();
    try {
      await writeRepoPkg(dir, {});
      // node_modules exists but dep entry doesn't — half-installed.
      await seedNodeModule(dir);
      const result = await isInstalled(SPECIFIER, dir, logger);
      t.false(result as boolean);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
);

// ---- concurrent autoinstall: lock + in-lock re-check ----

// Drives autoinstall against a real tmp repoDir with the lock engaged.
// Spawns two concurrent install attempts; the lock + in-lock isInstalled
// re-check ensures only one actually invokes install.
test.serial(
  'autoinstall: lock + in-lock re-check skips duplicate installFn invocations',
  async (t) => {
    const repoDir = await createTmpRepo();
    try {
      const stub = createInstallStub({ seedOnInstall: true, delayMs: 50 });
      const mod = await loadAutoinstall(stub.fn);

      // Build contexts inline so we can set lockRepo: true (default is false in
      // createContext to keep unrelated tests fast).
      const makeContext = () =>
        new ExecutionContext({
          state: {
            id: 'x',
            status: 'pending',
            plan: {
              workflow: {
                steps: [
                  {
                    adaptors: ['@openfn/language-common@1.0.0'],
                    expression: '.',
                  },
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
            whitelist,
            repoDir,
            // @ts-ignore
            autoinstall: {
              skipRepoValidation: true,
              // lock on by default — exercise the lock path here
            },
          },
        });

      const c1 = makeContext();
      const c2 = makeContext();

      await Promise.all([mod.default(c1), mod.default(c2)]);

      t.is(stub.calls.length, 1, 'install should run exactly once across both contexts');
    } finally {
      await removeTmpRepo(repoDir);
    }
  }
);
