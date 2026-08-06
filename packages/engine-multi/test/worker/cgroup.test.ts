import test from 'ava';
import os from 'node:os';
import { createMockLogger } from '@openfn/logger';

import {
  createChildCgroup,
  hasOomKill,
  isCgroupV2Available,
  parseProcSelfCgroup,
  removeChildCgroup,
  resolveSelfCgroup,
  _resetAvailabilityCache,
} from '../../src/worker/cgroup';

const logger = createMockLogger();

const isLinux = os.platform() === 'linux';

test.beforeEach(() => {
  _resetAvailabilityCache();
});

test('parseProcSelfCgroup resolves the v2 entry against the cgroup mount', (t) => {
  t.is(
    parseProcSelfCgroup('0::/system.slice/openfn.service\n'),
    '/sys/fs/cgroup/system.slice/openfn.service'
  );
});

test('parseProcSelfCgroup handles the namespace root', (t) => {
  t.is(parseProcSelfCgroup('0::/\n'), '/sys/fs/cgroup');
});

test('parseProcSelfCgroup returns null for a v1-only listing', (t) => {
  const v1 = ['12:memory:/user.slice', '3:cpu,cpuacct:/user.slice', ''].join(
    '\n'
  );
  t.is(parseProcSelfCgroup(v1), null);
});

if (!isLinux) {
  test('resolveSelfCgroup returns null on non-linux hosts', (t) => {
    t.is(resolveSelfCgroup(), null);
  });

  test('isCgroupV2Available returns false on non-linux hosts', (t) => {
    t.false(isCgroupV2Available('/sys/fs/cgroup/test', logger));
  });
}

if (isLinux) {
  test('resolveSelfCgroup returns a path under the cgroup mount', (t) => {
    const self = resolveSelfCgroup();
    // null is legitimate on a cgroup v1 host; otherwise the path must be
    // inside the mount and never a leader leaf (the enclosing cgroup is
    // returned instead)
    if (self !== null) {
      t.true(self.startsWith('/sys/fs/cgroup'));
      t.not(self.split('/').pop(), 'leader');
    } else {
      t.pass();
    }
  });
}

test('isCgroupV2Available returns false for a null parent', (t) => {
  t.false(isCgroupV2Available(null, logger));
});

test('isCgroupV2Available returns false for a parent outside the cgroup mount', (t) => {
  t.false(isCgroupV2Available('/tmp/not-a-cgroup', logger));
});

test('isCgroupV2Available returns false for a missing parent', (t) => {
  t.false(isCgroupV2Available('/sys/fs/cgroup/this/does/not/exist', logger));
});

test('availability probe is cached and only warns once', (t) => {
  const l = createMockLogger('test', { level: 'debug' });
  isCgroupV2Available('/sys/fs/cgroup/test-cache', l);
  isCgroupV2Available('/sys/fs/cgroup/test-cache', l);
  isCgroupV2Available('/sys/fs/cgroup/test-cache', l);

  const warnings = l._history.filter((h: any) => h[0] === 'warn');
  t.is(warnings.length, 1);
});

test('createChildCgroup returns null when the parent is not writable', (t) => {
  const handle = createChildCgroup(
    '/this/path/does/not/exist',
    12345,
    256 * 1024 * 1024,
    logger
  );
  t.is(handle, null);
});

test('hasOomKill returns false when the events file is missing', (t) => {
  t.false(
    hasOomKill({
      path: '/no/such/cgroup',
      eventsPath: '/no/such/cgroup/memory.events',
    })
  );
});

test('removeChildCgroup tolerates a null handle', (t) => {
  t.notThrows(() => removeChildCgroup(null, logger));
});

test('removeChildCgroup tolerates a non-existent cgroup', (t) => {
  t.notThrows(() =>
    removeChildCgroup(
      { path: '/no/such/cgroup', eventsPath: '/no/such/cgroup/memory.events' },
      logger
    )
  );
});
