import { readFileSync } from 'node:fs';
import { getHeapStatistics } from 'v8';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Project, describeDts } from '@openfn/describe-package';
import type { Logger } from '@openfn/logger';

export function heap(reason: string, logger?: Logger) {
  const { used_heap_size } = getHeapStatistics();
  const mb = used_heap_size / 1024 / 1024;
  logger?.debug(`[${reason}] Used heap at ${mb.toFixed(2)}mb`);
}

export const loadFile = (filePath: string) =>
  readFileSync(path.resolve(filePath), 'utf8');

// Detect if we've been handed a file path or some code
// It's a path if it has no linebreaks and ends in .js
export const isPath = (pathOrCode: string) =>
  // No line breaks
  !/(\r|\n|\r\n)/.test(pathOrCode) &&
  // End in .js or ojs
  /(ts|jso?n?|ojs)$/.test(pathOrCode);

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
      const functionDefs = {} as Record<string, true>;

      const adaptor = await findExports(pathToModule, pkg.types, project);
      adaptor.forEach(({ name }) => {
        if (name !== 'default') {
          functionDefs[name] = true;
        }
      });

      return Object.keys(functionDefs);
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

const findExports = async (
  moduleRoot: string,
  types: string,
  project: Project
) => {
  const results = [];

  const contents = await readFile(`${moduleRoot}/${types}`, 'utf8');
  project.createFile(contents, types);

  results.push(
    ...describeDts(project, types, {
      includePrivate: true,
    })
  );

  // Ensure that everything in adaptor.d.ts is exported
  // This is kinda cheating but it's quite safe for the time being
  const typesRoot = path.dirname(types);
  for (const dts of ['adaptor', 'Adaptor']) {
    try {
      const adaptorPath = `${moduleRoot}/${typesRoot}/${dts}.d.ts`;
      const contents = await readFile(adaptorPath, 'utf8');
      project.createFile(contents, adaptorPath);
      results.push(
        ...describeDts(project, adaptorPath, {
          includePrivate: true,
        })
      );
      break;
    } catch (e) {
      // no problem if this throws - likely the file doesn't exist
    }
  }

  return results;
};
