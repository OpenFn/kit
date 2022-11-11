// This is what I think the API of this thing should be

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
type PackageDescription = {
  name: string;
  version: string;
  functions: FunctionDescription[];
};

type FunctionDescription = {
  name: string;
  version: string; // is it helpful to inherit this? Probably not....
  magic: boolean; // keep you-know-who happy
  isOperation: boolean; // Is this an Operation?
  parameters: ParameterDescription[];
};

type ParameterDescription = {
  name: string;
  optional: boolean;
  type: string; // this is a human-readble string I think. Should we also store a machine readable type?
};

// I think we can get the API down to just these functions

export const describePackage = async (
  specifier: string,
  options: Options
): Promise<PackageDescription> => {};

// Load DTS as a string
// This would be used by monaco, which wants to load all the type defs for a package
// So it should return an array of modules really
// Would it still work as one string? Why not?
// This is called directly by Lightning's frontend at the moment, but I think it needs to be called from
// the server and have a repo passed in
export const loadDTS = async (
  specifier: string,
  options: Options
): Promise<string[]> => {};
