// logic to autoinstall a module
import exec from '../util/exec';
import ensureRepo from './ensure-repo';
import { getNameAndVersion, getLatestVersion } from './util';
import createLogger, { Logger } from '@openfn/logger';

// TODO decide where this is
// In practice I'm not sure it'll ever be used? Every runtime manager
// will provide a path, so its only core dev
export const defaultRepoPath = '/tmp/openfn/repo';

const defaultLogger = createLogger();

// Install the module at specifier into the repo at repoPath
// Should this be smart and check if it exists first?
// Yeah probably, then we can jsut call it all the time, let it sort out caching
// TODO support multiple installs in one call
export default async (
  specifier: string,
  repoPath: string = defaultRepoPath,
  log: Logger = defaultLogger
) => {
  await ensureRepo(repoPath);

  let { name, version } = getNameAndVersion(specifier);
  if (!version) {
    version = await getLatestVersion(specifier);
  }

  const flags = ['--no-audit', '--no-fund', '--no-package-lock'];
  const aliasedName = `${name}_${version}`;
  const alias = `npm:${name}@${version}`;

  const exists = await isModuleInstalled(aliasedName, repoPath);
  if (!exists) {
    // TODO use a proper logger here
    log.info(`Installing ${aliasedName} to ${repoPath}`);
    await exec(`npm install ${flags.join(' ')} ${aliasedName}@${alias}`, {
      cwd: repoPath,
    });
    log.success(`Installed ${specifier}`);
    return true;
  } else {
    log.debug(`Module ${specifier} already installed`);
  }
};
