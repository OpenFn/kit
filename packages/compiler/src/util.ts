import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Project, describeDts, fetchFile } from '../../describe-package/src/index';

export const loadFile = (filePath: string) => fs.readFileSync(path.resolve(filePath), 'utf8');

// Detect if we've been handed a file path or some code
// It's a path if it has no linebreaks and ends in .js
export const isPath = (pathOrCode: string) => 
  // No line breaks
  !/(\r|\n|\r\n)/.test(pathOrCode)
  // End in .js or ojs
  && /(ts|js|ojs)$/.test(pathOrCode)

// Helper to load the exports of a given npm package
// Can load from an unpkg specifier or a path to a local module
export const preloadAdaptorExports = async (specifier: string) => {
  const project = new Project();

  let pkg;
  let types;
  // load the package from unpkg or the filesystem
  if (specifier.startsWith('/') || specifier.startsWith('\.')) {
    // load locally
    const pkgSrc = await readFile(`${specifier}/package.json`, 'utf8');
    pkg = JSON.parse(pkgSrc);
    types =  await readFile(`${specifier}/${pkg.types}`, 'utf8');
  } else {
    // load from unpkg
    const pkgSrc = await fetchFile(`${specifier}/package.json`);
    pkg = JSON.parse(pkgSrc);
    types =  await fetchFile(`${specifier}/${pkg.types}`);
  }
  
  // Setup the project so we can read the dts definitions
  project.addToFS(types, pkg.types)
  project.createFile(types, pkg.types)
  
  // find the main dts
  const functionDefs = describeDts(project, pkg.types);
  // Return a flat array of names
  return functionDefs.map(({ name }) => name);
}