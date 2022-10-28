import exec from '../util/exec';
import { defaultRepoPath } from './install';

// Check if a mooule is installed to the repo
// Should take a string of the from module-name_major.minor.patch
// TODO actually I think this should take a general specifier
export default async (
  aliasedName: string,
  repoPath: string = defaultRepoPath
) => {
  // This arcane code looks in the package json to see if this package and version are already installed
  // npm pkg get returns {} if it doesn't find a match
  const { stdout } = await exec(`npm pkg get dependencies[${aliasedName}]`, {
    cwd: repoPath,
  });

  return stdout.trim() !== '{}';
};
