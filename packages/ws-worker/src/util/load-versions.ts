import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('../../package.json', 'utf-8'));
const versions = {
  node: process.version.substring(1),
  engine: pkg.version,
  compiler: pkg.dependencies?.['@openfn/compiler'],
  runtime: pkg.dependencies?.['@openfn/runtime'],
};

export default () => ({ ...versions });
