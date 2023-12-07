import pkg from '../../package.json' assert { type: 'json' };

import { Versions } from '../types';

// Load key versions at init time
const versions = {
  node: process.version.substring(1),
  engine: pkg.version,
  compiler: pkg.dependencies['@openfn/compiler'],
  runtime: pkg.dependencies['@openfn/runtime'],
};

// Return a shallow clone of versions
// because each workflow will scribble to it
export default (): Versions => ({ ...versions });
