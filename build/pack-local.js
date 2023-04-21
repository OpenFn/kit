const path = require('node:path');
const {
  findPackages,
  mapPackages,
  ensureOutputPath,
  updatePkg,
  getLocalTarballName,
} = require('./pack-helpers');

const outputPath = process.argv[2] || './dist';
const noVersion = process.argv[3] === '--no-version';

console.log(`Building local packages to ${outputPath}`);

findPackages().then(async (files) => {
  const pkgs = mapPackages(files);
  await ensureOutputPath(outputPath);

  Promise.all(files.map((f) => updatePkg(pkgs, f, noVersion, outputPath))).then(
    () => {
      const cliPath = getLocalTarballName(pkgs['@openfn/cli'], noVersion);
      console.log();
      console.log('Build complete!');
      console.log(`Install the CLI  the command below:`);
      console.log();
      console.log(`   npm install -g ${path.resolve(outputPath, cliPath)}`);
    }
  );
});
