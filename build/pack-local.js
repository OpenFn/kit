/**
 * This will load each of the built .tgzs, extract them in-memory,
 * update @openfn dependencies in package.json to use absolute local paths,
 * And write back to disk.
 */
const path = require('node:path')
const fs = require('node:fs');
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
      console.log('writing package json')
      const buf = Buffer.concat(data)
      
      const pkg = JSON.parse(buf.toString('utf8'));
      for (const dep in pkg.dependencies) {
        if (packageMap[dep]) {
          pkg.dependencies[dep] = packageMap[dep];
        }
      }
      console.log(pkg.dependencies);
      pack.entry({ name: 'package/package.json' }, JSON.stringify(pkg, null, 2), resolve)
    });
  });
}

function updatePkg(packageMap, filename) {
  const path = `dist/${filename}`;
  
  // The packer contains the new tarball
  var pack = tarStream.pack();
  console.log(' - Updating package', path)
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

    // Pipe to a .local file name
    // Reading and writing to the same tarball seems to cause problems, funnily enough
    pack.pipe(fs.createWriteStream(path.replace('.tgz', '-local.tgz')));
    
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
      obj[`@openfn/${mapped[1]}`] = path.resolve(file);
    }
    return obj;
  }, {});
}

console.log('Updating package.jsons')
findPackages().then(async (files) => {
  const pkgs = mapPackages(files);
  Promise.all(files.map((f) => updatePkg(pkgs, f)));
})

