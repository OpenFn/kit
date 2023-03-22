import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Project, describeDts, fetchFile } from '@openfn/describe-package';
import type { Logger } from '@openfn/logger';

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
// At the moment this expects to be passed a path to a local module,
// But we may relax this  later.
export const preloadAdaptorExports = async (
  pathToModule: string,
  log?: Logger
) => {
  const project = new Project();
  let pkg;
  let types;
  // load the package from unpkg or the filesystem
  if (isRelativeSpecifier(pathToModule)) {
    // load locally
    const pkgSrc = await readFile(`${pathToModule}/package.json`, 'utf8');
    pkg = JSON.parse(pkgSrc);
    if (pkg.types) {
      types = await readFile(`${pathToModule}/${pkg.types}`, 'utf8');
    }
  } else {
    // Do not load absolute modules
    // We can later do this with fetchFile(`${specifier}/package.json`)
    if (log) {
      log.info(`Skipping adaptor export preload for ${pathToModule}`);
    }
  }

  if (types) {
    // Setup the project so we can read the dts definitions
    project.addToFS(types, pkg.types);
    project.createFile(types, pkg.types);

    // find the main dts
    const functionDefs = describeDts(project, pkg.types, {
      includePrivate: true,
    });

    // Return a flat array of names
    return functionDefs.map(({ name }) => name);
  }
  return [];
};
