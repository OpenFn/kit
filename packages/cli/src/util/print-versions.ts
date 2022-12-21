import { Logger } from './logger';
import { mainSymbols } from 'figures';

const { triangleRightSmall: t } = mainSymbols;

const printVersions = async (logger: Logger) => {
  const pkg = await import('../../package.json', { assert: { type: 'json' } });
  const { version, dependencies } = pkg.default;

  const compilerVersion = dependencies['@openfn/compiler'];
  const runtimeVersion = dependencies['@openfn/runtime'];

  logger.info(`Versions:
        ${t} Node.js   ${process.version.substring(1)}
        ${t} cli       ${version}
        ${t} runtime   ${runtimeVersion}
        ${t} compiler  ${compilerVersion}`);
};

export default printVersions;
