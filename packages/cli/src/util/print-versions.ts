import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getNameAndVersion } from '@openfn/runtime';
import { Logger } from './logger';
import { mainSymbols } from 'figures';
import { SafeOpts } from '../commands';

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
  // Prefix and pad version numbers
  const prefix = (str: string) =>
    `         ${t} ${str.padEnd(options.adaptors ? 24 : 8, ' ')}`;

  const pkg = await import('../../package.json', { assert: { type: 'json' } });
  const { version, dependencies } = pkg.default;

  const compilerVersion = dependencies['@openfn/compiler'];
  const runtimeVersion = dependencies['@openfn/runtime'];

  const { adaptors } = options;
  let adaptorName, adaptorVersion;
  if (adaptors && adaptors.length === 1) {
    const [a] = adaptors;
    const { name, version } = getNameAndVersion(a);
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
${prefix('node.js')}${process.version.substring(1)}
${prefix('cli')}${version}
${prefix('runtime')}${runtimeVersion}
${prefix('compiler')}${compilerVersion}${adaptorVersionString}`;
  }
  logger.info(output);
};

export default printVersions;
