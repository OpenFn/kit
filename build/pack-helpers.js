/**
 * This will load each of the built .tgzs, extract them in-memory,
 * update @openfn dependencies in package.json to use absolute local paths,
 * And write back to disk.
 */
const path = require('node:path');
const fs = require('node:fs');
const { mkdir } = require('node:fs/promises');
const { createGzip } = require('node:zlib');
const tarStream = require('tar-stream');
const gunzip = require('gunzip-maybe');

// Find built packages in the ./dist folder
async function findPackages() {
  return new Promise((resolve) => {
    fs.readdir(path.resolve('./dist'), { encoding: 'utf8' }, (err, files) => {
      resolve(files.filter((p) => !/(-local)/.test(p) && p.endsWith('tgz')));
    });
  });
}

const getLocalTarballName = (packagePath, noVersion = false) =>
  noVersion
    ? packagePath.replace(/\-\d+.\d+.\d+.tgz/, '.tgz')
    : packagePath.replace('.tgz', '-local.tgz');

function processPackageJSON(stream, packageMap, pack, noVersion, onPackage) {
  return new Promise((resolve) => {
    const data = [];
    stream.on('data', (c) => data.push(c));
    stream.on('end', () => {
      const buf = Buffer.concat(data);

      const pkg = JSON.parse(buf.toString('utf8'));
      for (const dep in pkg.dependencies) {
        if (packageMap[dep]) {
          const mappedName = getLocalTarballName(packageMap[dep], noVersion);
          console.log(`Mapping ${dep} to ${mappedName}`);
          pkg.dependencies[dep] = mappedName;
        }
      }
      if (onPackage) {
        onPackage(pkg.name, pkg);
      }
      pack.entry(
        { name: 'package/package.json' },
        JSON.stringify(pkg, null, 2),
        resolve
      );
    });
  });
}

function updatePkg(packageMap, filename, noVersion, outputPath, onPackage) {
  const pkgPath = `dist/${filename}`;
  console.log(' - Updating package', pkgPath);

  // The packer contains the new (gzipped) tarball
  const pack = tarStream.pack();

  return new Promise((resolve) => {
    // The extractor streams the old tarball
    var extract = tarStream.extract();
    extract.on('entry', (header, stream, next) => {
      if (header.name === 'package/package.json') {
        processPackageJSON(stream, packageMap, pack, noVersion, onPackage).then(
          next
        );
      } else {
        stream.pipe(pack.entry(header, next));
      }
    });

    // Pipe to a -local file name
    // Reading and writing to the same tarball seems to cause problems, funnily enough
    const target = getLocalTarballName(
      `${path.resolve(outputPath)}/${filename}`,
      noVersion
    );
    const out = fs.createWriteStream(target);
    // Note that we have to start piping to the output stream immediately,
    // otherwise we get backpressure fails on the pack stream
    pack.pipe(createGzip()).pipe(out);

    fs.createReadStream(pkgPath).pipe(gunzip()).pipe(extract);

    extract.on('finish', () => {
      pack.finalize();
      resolve();
    });
  });
}

// Map the tgz packages in dist to npm package names
const mapPackages = (files) => {
  return files.reduce((obj, file) => {
    const mapped = /openfn-(.+)-\d+\.\d+\.\d+\.tgz/.exec(file);
    if (mapped && mapped[1]) {
      obj[`@openfn/${mapped[1]}`] = `./${file}`;
    }
    return obj;
  }, {});
};

const ensureOutputPath = async (outputPath) =>
  mkdir(path.resolve(outputPath), { recursive: true });

module.exports = {
  mapPackages,
  updatePkg,
  findPackages,
  ensureOutputPath,
  getLocalTarballName,
};
