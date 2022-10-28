// logic to autoinstall a module
import exec from '../util/exec';
import ensureRepo from './ensure-repo';
import getNameAndVersion from './get-name-and-version';
import isModuleInstalled from './is-module-installed';

// TODO decide where this is
// In practice I'm not sure it'll ever be used? Every runtime manager
// will provide a path, so its only core dev
export const defaultRepoPath = '/tmp/openfn/repo';

// Install the module at specifier into the repo at repoPath
// Should this be smart and check if it exists first?
// Yeah probably, then we can jsut call it all the time, let it sort out caching
// TODO support multiple installs in one call
export default async (
  specifier: string,
  repoPath: string = defaultRepoPath
) => {
  await ensureRepo(repoPath);

  // So if a version isn't passed in the specifier, how do we know what will be installed?
  const { name, version } = await getNameAndVersion(specifier);

  const flags = ['--no-audit', '--no-fund', '--no-package-lock'];
  const aliasedName = `${name}_${version}`;
  const alias = `@npm:${name}@${version}`;

  const exists = await isModuleInstalled(aliasedName, repoPath);
  if (!exists) {
    // TODO use a proper logger here
    console.log(`installing ${aliasedName} to ${repoPath}`);
    await exec(`npm install ${flags.join(' ')} ${alias}`, {
      cwd: repoPath,
    });
    return true;
  }
};
