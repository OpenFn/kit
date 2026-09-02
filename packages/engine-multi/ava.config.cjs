const baseConfig = require('../../ava.config');

module.exports = {
  ...baseConfig,
  files: [
    'test/**/*.test.ts',

    // Enforcement tests must be rub in an isolated cgroup
    // via pnpm test:cgroup
    '!test/worker/cgroup-enforcement.test.ts',
  ],
};
