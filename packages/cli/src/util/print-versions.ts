import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getNameAndVersion } from '@openfn/runtime';
import { Logger } from './logger';
import { mainSymbols } from 'figures';
import { SafeOpts } from '../commands';

const NODE = 'nodejs';
const CLI = 'cli';
const RUNTIME = 'runtime';
const COMPILER = 'compiler';

const { triangleRightSmall: t } = mainSymbols;

const loadVersionFromPath = (adaptorPath: string) => {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(adaptorPath, 'package.json'), 'utf8'));
    return pkg.version
  } catch(e) {
    return 'unknown';
  }
}

const printVersions = async (
  logger: Logger,
  options: Partial<Pick<SafeOpts, 'adaptors' | 'logJson'>> = {}
  ) => {
  const { adaptors } = options;
  let adaptor = '';
  if (adaptors && adaptors.length) {
    adaptor = adaptors[0];
  }

  // Work out the longest label
  const longest = Math.max(...[
    NODE,
    CLI,
    RUNTIME,
    COMPILER,
    adaptor,
  ].map(s => s.length));
  
  // Prefix and pad version numbers
  const prefix = (str: string) =>
    `         ${t} ${str.padEnd(longest + 4, ' ')}`;

  const pkg = await import('../../package.json', { assert: { type: 'json' } });
  const { version, dependencies } = pkg.default;
  
  const compilerVersion = dependencies['@openfn/compiler'];
  const runtimeVersion = dependencies['@openfn/runtime'];
  
  let adaptorVersion;
  let adaptorName;
  if (adaptor) {
    const { name, version } = getNameAndVersion(adaptor);
    if (name.match('=')) {
      const [namePart, pathPart] = name.split('=');
      adaptorVersion = loadVersionFromPath(pathPart);
      adaptorName = namePart;
    } else {
      adaptorName = name;
      adaptorVersion = version || 'latest';
    }
  }

  let output: any;
  if (options.logJson) {
    output = {
      versions: {
        'node.js': process.version.substring(1),
        cli: version,
        runtime: runtimeVersion,
        compiler: compilerVersion,
      },
    };
    if (adaptorName) {
      output.versions.adaptor = {
        name: adaptorName,
        version: adaptorVersion,
      };
    }
  } else {
    const adaptorVersionString = adaptorName
      ? `\n${prefix(adaptorName)}${adaptorVersion}`
      : '';

    output = `Versions:
${prefix(NODE)}${process.version.substring(1)}
${prefix(CLI)}${version}
${prefix(RUNTIME)}${runtimeVersion}
${prefix(COMPILER)}${compilerVersion}${adaptorVersionString}`;
  }
  logger.info(output);
};

export default printVersions;
