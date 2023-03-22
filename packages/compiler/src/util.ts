import { readFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Project, describeDts } from '@openfn/describe-package';
import type { Logger } from '@openfn/logger';

export const loadFile = (filePath: string) =>
  readFileSync(path.resolve(filePath), 'utf8');

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
  // load the package from unpkg or the filesystem
  if (isRelativeSpecifier(pathToModule)) {
    // load locally
    const pkgSrc = await readFile(`${pathToModule}/package.json`, 'utf8');
    pkg = JSON.parse(pkgSrc);
    if (pkg.types) {
      const functionDefs = [];

      // load common into the project
      // This assumes that common is installed as a sibling of the adaptor we need, which is weak
      if (!pathToModule.match(/language-common/)) {
        try {
          const common = await findExports(
            path.resolve(pathToModule, '../language-common'),
            'types/index.d.ts',
            project
          );
          if (common) {
            functionDefs.push(...common.map(({ name }) => name));
          }
        } catch (e) {
          log?.debug('Failed to load types from langauge common');
        }
      }

      const mod = await findExports(pathToModule, pkg.types, project);

      // Return a flat array of names
      functionDefs.push(...mod.map(({ name }) => name));

      return functionDefs;
    }
  } else {
    // Do not load absolute modules
    // We can later do this with fetchFile(`${specifier}/package.json`)
    if (log) {
      log.info(`Skipping adaptor export preload for ${pathToModule}`);
    }
  }

  return [];
};

// TODO this should all be done by describe-package really, but that's too focused around jsdelivr
// what about dependencies on common? Will we see the exports? We just need the names...
// No, we don't see the exports :(
const findExports = async (
  moduleRoot: string,
  types: string,
  project: Project
) => {
  const typesRoot = path.dirname(types);
  const files = await readdir(`${moduleRoot}/${typesRoot}`);
  const dtsFiles = files.filter((f) => f.endsWith('.d.ts'));
  const result = [];
  for (const f of dtsFiles) {
    const relPath = `${typesRoot}/${f}`;
    const contents = await readFile(`${moduleRoot}/${relPath}`, 'utf8');
    project.createFile(contents, relPath);

    result.push(
      ...describeDts(project, relPath, {
        includePrivate: true,
      })
    );
  }
  return result;
};
