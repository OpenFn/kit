const baseConfig = require('../../ava.config');

module.exports = {
  ...baseConfig,

  files: ['!test/memory.test.ts'],
};
