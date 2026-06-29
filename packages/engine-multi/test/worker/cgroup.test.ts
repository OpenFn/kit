import test from 'ava';
import os from 'node:os';
import { createMockLogger } from '@openfn/logger';

import {
  DEFAULT_CGROUP_PARENT,
  createChildCgroup,
  hasOomKill,
  isCgroupV2Available,
  removeChildCgroup,
  _resetAvailabilityCache,
} from '../../src/worker/cgroup';

const logger = createMockLogger();

const isLinux = os.platform() === 'linux';

test.beforeEach(() => {
  _resetAvailabilityCache();
});

test('DEFAULT_CGROUP_PARENT lives under the cgroup root', (t) => {
  t.is(DEFAULT_CGROUP_PARENT, '/sys/fs/cgroup/openfn');
});

// cgroups don't exist on macOS/Windows, so the whole module must no-op there.
if (!isLinux) {
  test('isCgroupV2Available returns false on non-linux hosts', (t) => {
    t.false(isCgroupV2Available(DEFAULT_CGROUP_PARENT, logger));
  });

  test('availability probe is cached and only warns once', (t) => {
    const l = createMockLogger('test', { level: 'debug' });
    isCgroupV2Available('/sys/fs/cgroup/test-cache', l);
    isCgroupV2Available('/sys/fs/cgroup/test-cache', l);
    isCgroupV2Available('/sys/fs/cgroup/test-cache', l);

    const warnings = l._history.filter((h: any) => h[0] === 'warn');
    t.is(warnings.length, 1);
  });
}

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
