import { getNameAndVersion } from './util';
import { Project } from './typescript/project';
import { fetchDTSListing, fetchFile } from './fs/package-fs';
import describeProject from './describe-project';

// Sketching
type Options = {
  // Allow to pass an explicit path to the module
  // would this be used instead of a specifier... ?
  path?: string;

  // some kind of metadata which tells us where to look
  // If we can't find the package in the repo, we'll go to unpkg
  // this is designed to play with a server-side cache as well as the runtime
  repo?: string; // TODO is it just a path?

  // Is it a helpful optimisation to pass in a pre-declared ts project?
  project?: any;

  cache?: any; // An in-memory cache of what we've already done?
};

// Is this a generic package, or an adaptor? Maybe try and keep it generic
// Although in the short-medium term it's only gonna be used for adaptors
export type PackageDescription = {
  name: string;
  version: string;
  functions: FunctionDescription[];
  namespaces: NamespaceDescription[];
};

export type FunctionDescription = {
  name: string;
  type: 'function';
  magic: boolean; // keep you-know-who happy
  isOperation: boolean; // Is this an Operation?
  parameters: ParameterDescription[];
  description: string;
  examples: ExampleDescription[];
  parent?: string;
};

export type NamespaceDescription = {
  name: string;
  type: 'namespace';
};

type ExampleDescription = {
  code: string;
  caption?: string;
};

export type ParameterDescription = {
  name: string;
  optional: boolean;
  type: string; // this is a human-readble string I think. Should we also store a machine readable type?
};

/*
 * describePackage will describe all the publicly exported functions of an adaptor
 * This is expected to be the main (only?) enytrypoint for this package
 * - Each function MUST have an @public jsdoc tag
 * - The beta file is excluded
 */
export const describePackage = async (
  specifier: string,
  _options: Options
): Promise<PackageDescription> => {
  const { name, version } = getNameAndVersion(specifier);
  const project = new Project();

  if (name != '@openfn/language-common') {
    // Include language-common in the project model
    // (I don't expect this to be permanent)

    // First work out the correct version
    const pkgStr = await fetchFile(`${specifier}/package.json`);
    const pkg = JSON.parse(pkgStr);

    if (pkg.dependencies['@openfn/language-common']) {
      const commonSpecifier = `@openfn/language-common@${pkg.dependencies[
        '@openfn/language-common'
      ].replace('^', '')}`;

      // fetch that specific version
      const common = await fetchDTSListing(commonSpecifier);
      // Load it into the project
      for await (const fileName of common) {
        const f = await fetchFile(`${commonSpecifier}${fileName}`);
        // Flatten the paths or else there's trouble
        // TODO need to better understand this at some stage
        const relativeFileName = fileName.split('/').pop();
        project.addTypeDefinition(
          '@openfn/language-common',
          f,
          relativeFileName
        );
      }
    }
  }

  // Now fetch the listings for the actual package
  const files = await fetchDTSListing(specifier);

  const functions: FunctionDescription[] = [];
  const namespaces: NamespaceDescription[] = [];
  for await (const fileName of files) {
    // Exclude the beta file
    if (!/beta\.d\.ts$/.test(fileName)) {
      const f = await fetchFile(`${specifier}${fileName}`);
      project.createFile(f, fileName);

      describeProject(project, fileName).forEach((member) => {
        if (member.type === 'function') {
          functions.push(member);
        } else if (member.type === 'namespace') {
          namespaces.push(member);
        }
      });
    }
  }

  return {
    name,
    version,
    functions,
    namespaces,
  };
};

// Load DTS as a string
// This would be used by monaco, which wants to load all the type defs for a package
// So it should return an array of modules really
// Would it still work as one string? Why not?
// This is called directly by Lightning's frontend at the moment, but I think it needs to be called from
// the server and have a repo passed in
export const loadDTS = async (
  _specifier: string,
  _options: Options
): Promise<string[]> => ['declare module {}'];
