import exec from '../util/exec';

// Check if a mooule is installed to the repo
// Should take a string of the from module-name_major.minor.patch
export default async (aliasedName: string, repoPath: string) => {
  // This arcane code looks in the package json to see if this package and version are already installed
  // npm pkg get returns {} if it doesn't find a match
  const { stdout } = await exec(`npm pkg get dependencies[${aliasedName}]`, {
    cwd: repoPath,
  });

  return stdout.trim() !== '{}';
};
