import { Logger } from './logger';
import { mainSymbols } from 'figures';
import { SafeOpts } from '../commands';
import { getNameAndVersion } from '@openfn/runtime';

const { triangleRightSmall: t } = mainSymbols;

const printVersions = async (
  logger: Logger,
  options: Partial<Pick<SafeOpts, 'adaptors'>> = {}
) => {
  // Prefix and pad version numbers
  const prefix = (str: string) =>
    `         ${t} ${str.padEnd(options.adaptors ? 16 : 8, ' ')}`;

  const pkg = await import('../../package.json', { assert: { type: 'json' } });
  const { version, dependencies } = pkg.default;

  const compilerVersion = dependencies['@openfn/compiler'];
  const runtimeVersion = dependencies['@openfn/runtime'];

  const { adaptors } = options;
  let adaptorVersionString = '';
  if (adaptors && adaptors.length === 1) {
    const [a] = adaptors;
    const { name, version } = getNameAndVersion(a);
    adaptorVersionString = `\n${prefix(
      'adaptor ' + name.replace(/^@openfn\/language-/, '')
    )}${version || 'latest'}`;
  }

  logger.info(`Versions:
${prefix('node.js')}${process.version.substring(1)}
${prefix('cli')}${version}
${prefix('runtime')}${runtimeVersion}
${prefix('compiler')}${compilerVersion}${adaptorVersionString}`);
};

export default printVersions;
