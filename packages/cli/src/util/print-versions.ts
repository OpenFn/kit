import { Logger } from './logger';
import { mainSymbols } from 'figures';
import { Opts } from '../commands';

const { triangleRightSmall: t } = mainSymbols;

const printVersions = async (
  logger: Logger,
  options: Pick<Opts, 'logJson'> = {}
) => {
  const pkg = await import('../../package.json', { assert: { type: 'json' } });
  const { version, dependencies } = pkg.default;

  const compilerVersion = dependencies['@openfn/compiler'];
  const runtimeVersion = dependencies['@openfn/runtime'];

  if (options.logJson) {
    logger.info({
      versions: {
        'Node.js': process.version.substring(1),
        cli: version,
        runtime: runtimeVersion,
        compiler: compilerVersion,
      },
    });
  } else {
    logger.info(`Versions:
          ${t} Node.js   ${process.version.substring(1)}
          ${t} cli       ${version}
          ${t} runtime   ${runtimeVersion}
          ${t} compiler  ${compilerVersion}`);
  }
};

export default printVersions;
