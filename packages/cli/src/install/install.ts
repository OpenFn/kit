import type { Opts } from '../commands';
import type { Logger } from '../util/logger';
import { install } from '@openfn/runtime';

// Bit wierd
// I want to declare what install COULD use
// maybe packages and modulesHome are actually required?
type InstallOpts = Partial<Pick<Opts, 'packages' | 'adaptor' | 'modulesHome'>>;

export default async (opts: InstallOpts, log: Logger) => {
  let { packages, adaptor, modulesHome } = opts;
  if (packages) {
    if (adaptor) {
      packages = packages.map((name) => `@openfn/language-${name}`);
    }
    // log.info(`Installing ${packages.length} packages to ${modulesHome}`);
    // log.info(packages);

    // TODO modulesHome becomes something like repoHome
    await install(packages[0], modulesHome, log);

    // log.success('Installed packages: ', packages);
  }
};
