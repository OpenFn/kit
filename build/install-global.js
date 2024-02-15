const { exec } = require('node:child_process');
const path = require('node:path');
const {
  findPackages,
  mapPackages,
  ensureOutputPath,
  updatePkg,
  getLocalTarballName,
} = require('./pack-helpers');

const outputPath = process.argv[2] || './dist';

// TODO need some kinda of special suffix for all these

// Package everything up like a local build
exec('git branch --show-current', {}, async (err, branchName) => {
  console.log('Installing openfnx for branch:', branchName);
  console.log();
  const files = await findPackages();
  const pkgs = mapPackages(files);
  await ensureOutputPath(outputPath);

  // Intercept package.json before it's written to the tgz and override some stuff
  // This won't change the tarball name though
  const onPackage = (packageName, pkg) => {
    if (packageName == '@openfn/cli') {
      pkg.name = `@openfn/clix`;
      pkg.bin = {
        openfnx: 'dist/index.js',
      };
      pkg.version = `branch/${branchName.trim()}`;
    }
  };

  Promise.all(
    files.map((f) => {
      return updatePkg(pkgs, f, false, outputPath, onPackage);
    })
  ).then(async () => {
    const cliPath = getLocalTarballName(pkgs['@openfn/cli']);
    const command = `npm install -g ${path.resolve(outputPath, cliPath)}`;
    //console.log(command);

    await exec(command);
    // install the local CLI globally

    console.log();
    console.log('openfnx installed successfully! To test:');
    console.log('  openfnx --version');
  });
});
