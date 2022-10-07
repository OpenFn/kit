import baseConfig from '../../tsup.config';

export default {
  ...baseConfig,
  entry: {
    index: 'src/index.ts',
    'process/runner': 'src/process/runner.ts'
  }
}