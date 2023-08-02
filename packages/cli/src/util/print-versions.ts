import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getNameAndVersion } from '@openfn/runtime';
import { Logger } from './logger';
import { mainSymbols } from 'figures';
import { Opts } from '../options';

const NODE = 'node.js';
const CLI = 'cli';
const RUNTIME = 'runtime';
const COMPILER = 'compiler';

const { triangleRightSmall: t } = mainSymbols;

const loadVersionFromPath = (adaptorPath: string) => {
  try {
    const pkg = JSON.parse(
      readFileSync(path.resolve(adaptorPath, 'package.json'), 'utf8')
    );
    return pkg.version;
  } catch (e) {
    return 'unknown';
  }
};

const printVersions = async (
  logger: Logger,
  options: Partial<Pick<Opts, 'adaptors' | 'logJson'>> = {}
) => {
  const { adaptors, logJson } = options;
  let adaptor = '';
  if (adaptors && adaptors.length) {
    adaptor = adaptors[0];
  }

  let adaptorVersion;
  let adaptorName = '';
  if (adaptor) {
    if (adaptor.match('=')) {
      const [namePart, pathPart] = adaptor.split('=');
      adaptorVersion = loadVersionFromPath(pathPart);
      adaptorName = getNameAndVersion(namePart).name;
    } else {
      const { name, version } = getNameAndVersion(adaptor);
      adaptorName = name;
      adaptorVersion = version || 'latest';
    }
  }

  // Work out the longest label
  const longest = Math.max(
    ...[NODE, CLI, RUNTIME, COMPILER, adaptorName].map((s) => s.length)
  );

  // Prefix and pad version numbers
  const prefix = (str: string) =>
    `         ${t} ${str.padEnd(longest + 4, ' ')}`;

  const pkg = await import('../../package.json', { assert: { type: 'json' } });
  const { version, dependencies } = pkg.default;

  const compilerVersion = dependencies['@openfn/compiler'];
  const runtimeVersion = dependencies['@openfn/runtime'];

  let output: any;
  if (logJson) {
    output = {
      versions: {
        'node.js': process.version.substring(1),
        cli: version,
        runtime: runtimeVersion,
        compiler: compilerVersion,
      },
    };
    if (adaptorName) {
      output.versions[adaptorName] = adaptorVersion;
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
  logger.always(output);
};

export default printVersions;
