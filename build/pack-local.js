/**
 * This will load each of the built .tgzs, extract them in-memory,
 * update @openfn dependencies in package.json to use absolute local paths,
 * And write back to disk.
 */
const path = require('node:path')
const fs = require('node:fs');
const { createGzip } = require('node:zlib');
const tarStream = require('tar-stream');
const gunzip = require('gunzip-maybe');

async function findPackages() {
  return new Promise((resolve) => {
    fs.readdir(path.resolve('dist'), { encoding: 'utf8' }, (err, files) => {
      resolve(files.filter(p => p.endsWith('tgz')));
    });
  });
}

function processPackageJSON(stream, packageMap, pack) {
  return new Promise(resolve => {
    const data = [];
    stream.on('data', c => data.push(c))
    stream.on('end', () => {
      const buf = Buffer.concat(data)
      
      const pkg = JSON.parse(buf.toString('utf8'));
      for (const dep in pkg.dependencies) {
        if (packageMap[dep]) {
          console.log(`Mapping ${dep} to ${packageMap[dep]}`)
          pkg.dependencies[dep] = packageMap[dep];
        }
      }
      pack.entry({ name: 'package/package.json' }, JSON.stringify(pkg, null, 2), resolve)
    });
  });
}

function updatePkg(packageMap, filename) {
  const path = `dist/${filename}`;
  console.log(' - Updating package', path)
  
  // The packer contains the new (gzipped) tarball
  const pack = tarStream.pack();
  pack.pipe(createGzip());

  return new Promise((resolve) => {
    // The extractor streams the old tarball
    var extract = tarStream.extract();
    extract.on('entry', (header, stream, next) => {
      if (header.name === 'package/package.json') {
        processPackageJSON(stream, packageMap, pack).then(next)
      }
      else {
        stream.pipe(pack.entry(header, next));
      }
    });

    // Pipe to a -local file name
    // Reading and writing to the same tarball seems to cause problems, funnily enough
    const out = fs.createWriteStream(path.replace('.tgz', '-local.tgz'))
    // Note that we have to start piping to the output stream immediately,
    // otherwise we get backpressure fails on the pack stream
    pack.pipe(out);
    
    fs.createReadStream(path)
      .pipe(gunzip())
      .pipe(extract)
      
    extract.on('finish', () => {
      pack.finalize()
      resolve();
    });
  });   
}

// Map the tgz packages in dist to npm package names
const mapPackages = (files) => {
  return files.reduce((obj, file) => {
    const mapped = /openfn-(.+)-\d+\.\d+\.\d+\.tgz/.exec(file)
    if (mapped && mapped[1]) {
      obj[`@openfn/${mapped[1]}`] = path.resolve('dist', file);
    }
    return obj;
  }, {});
}

console.log('Updating package.jsons')
findPackages().then(async (files) => {
  const pkgs = mapPackages(files);
  Promise.all(files.map((f) => updatePkg(pkgs, f))).then(() => {
    console.log();
    console.log('Build complete!');
    console.log(`Install the CLI from ${pkgs['@openfn/cli']} with the command below:`)
    console.log();
    console.log(`   npm install -g dist/${pkgs['@openfn/cli']}`)
  })
})

