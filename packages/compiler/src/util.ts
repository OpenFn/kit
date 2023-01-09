import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Project, describeDts, fetchFile } from '@openfn/describe-package';

export const loadFile = (filePath: string) =>
  fs.readFileSync(path.resolve(filePath), 'utf8');

// Detect if we've been handed a file path or some code
// It's a path if it has no linebreaks and ends in .js
export const isPath = (pathOrCode: string) =>
  // No line breaks
  !/(\r|\n|\r\n)/.test(pathOrCode) &&
  // End in .js or ojs
  /(ts|js|ojs)$/.test(pathOrCode);

// Check if a path is a local file path (a relative specifier according to nodejs)
export const isRelativeSpecifier = (specifier: string) =>
  /^(\/|\.|~|\w\:\\)/.test(specifier);

// Helper to load the exports of a given npm package
// Can load from an unpkg specifier or a path to a local module
export const preloadAdaptorExports = async (specifier: string) => {
  const project = new Project();
  let pkg;
  let types;
  // load the package from unpkg or the filesystem
  if (isRelativeSpecifier(specifier)) {
    const prefix = process.platform == 'win32' ? 'file://' : '';
    // load locally
    const pkgSrc = await readFile(`${prefix}${specifier}/package.json`, 'utf8');
    pkg = JSON.parse(pkgSrc);
    if (pkg.types) {
      types = await readFile(`${prefix}${specifier}/${pkg.types}`, 'utf8');
    } else {
      // If there's no type information, we can safely return
      // TODO should we log a warning?
      return [];
    }
  } else {
    // TODO this should never be used right now - the CLI should always pass in a path

    // TODO - if modules_home is set, we should look there for definitions before calling out to unpkg
    // load from unpkg
    const pkgSrc = await fetchFile(`${specifier}/package.json`);
    pkg = JSON.parse(pkgSrc);
    types = await fetchFile(`${specifier}/${pkg.types}`);
  }

  // Setup the project so we can read the dts definitions
  project.addToFS(types, pkg.types);
  project.createFile(types, pkg.types);

  // find the main dts
  const functionDefs = describeDts(project, pkg.types, {
    includePrivate: true,
  });
  // Return a flat array of names
  return functionDefs.map(({ name }) => name);
};
