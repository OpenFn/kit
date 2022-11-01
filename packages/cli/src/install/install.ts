import type { SafeOpts } from '../commands';
import type { Logger } from '../util/logger';
import { install } from '@openfn/runtime';

export default async (opts: SafeOpts, log: Logger) => {
  let { packages, adaptor } = opts;
  if (adaptor) {
    packages = packages.map((name) => `@openfn/language-${name}`);
  }
  log.info(`Installing ${packages.length} packages to ${opts.modulesHome}`);
  log.info(packages);

  // TODO modulesHome becomes something like repoHome
  await install(packages[0], opts.modulesHome);

  log.success('Installed packages: ', packages);
};
