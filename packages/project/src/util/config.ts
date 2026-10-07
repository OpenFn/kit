import type l from '@openfn/lexicon';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pickBy, isNil } from 'lodash-es';
import { yamlToJson, jsonToYaml } from './yaml';
import Project from '../Project';

// Recursively sort object keys so that config files serialize stably
const sortKeys = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((obj: any, key) => {
        obj[key] = sortKeys(value[key]);
        return obj;
      }, {});
  }
  return value;
};

// Initialize and default Workspace (and Project) config

export const buildConfig = (config: Partial<l.WorkspaceConfig> = {}) => ({
  credentials: 'credentials.yaml',
  ...config,
  dirs: {
    projects: config.dirs?.projects ?? '.projects',
    workflows: config.dirs?.workflows ?? 'workflows',
    ...(config.dirs?.compiled && { compiled: config.dirs.compiled }),
  },
  formats: {
    openfn: config.formats?.openfn ?? 'yaml',
    project: config.formats?.project ?? 'yaml',
    workflow: config.formats?.workflow ?? 'yaml',
  },
});

// The checkout file tracks which project is expanded into the workflows dir,
// plus any transient sync state. When on a git branch, each branch gets its
// own checkout file so that merges don't clobber the target branch's checkout
export const getCheckoutPath = (branch?: string | false | null) =>
  branch
    ? path.join('.openfn', 'branches', branch, 'checkout.yaml')
    : path.join('.openfn', 'checkout.yaml');

// Generate the checkout file for a project
export const extractCheckout = (
  source: Project,
  branch?: string | false | null
) => {
  const project: any = {
    ...(source.openfn || {}),
    id: source.id,
  };
  if (source.name) {
    project.name = source.name;
  }

  if (source.cli.forked_from && Object.keys(source.cli.forked_from).length) {
    project.forked_from = source.cli.forked_from;
  }

  return {
    path: getCheckoutPath(branch),
    content: jsonToYaml(sortKeys(project)),
  };
};

// Load project metadata from the checkout file
// If there's no checkout file, fall back to the legacy project block
// in openfn.yaml (which will be migrated on the next write)
export const loadCheckoutFile = (
  root: string = '.',
  branch?: string | false | null,
  legacyProject?: l.ProjectMeta
): l.ProjectMeta | undefined => {
  try {
    const content = readFileSync(
      path.resolve(root, getCheckoutPath(branch)),
      'utf8'
    );
    return (yamlToJson(content) as l.ProjectMeta) ?? {};
  } catch (e) {
    if (legacyProject && Object.keys(legacyProject).length) {
      return legacyProject;
    }
  }
};

// Generate a workspace config (openfn.yaml) file for a project
export const extractConfig = (source: Project, format?: 'yaml' | 'json') => {
  const workspace = {
    ...source.config,
  };

  format = format ?? workspace.formats.openfn;
  if (format === 'yaml') {
    return {
      path: 'openfn.yaml',
      content: jsonToYaml(sortKeys(workspace)),
    };
  }
  return {
    path: 'openfn.json',
    content: JSON.stringify(sortKeys(workspace), null, 2),
  };
};

export const loadWorkspaceFile = (
  contents: string | l.WorkspaceFile | l.WorkspaceFileLegacy,
  format: 'yaml' | 'json' = 'yaml'
) => {
  let project, workspace, collections: string[] | undefined;
  let json: any = contents;
  if (format === 'yaml') {
    json = yamlToJson(contents as any) ?? {};
  } else if (typeof contents === 'string') {
    json = JSON.parse(contents);
  }

  // Flat format: top level keys are workspace config (plus a legacy project block)
  // Nested format: { workspace, project }
  const legacy = !json.workspace && !json.projects;
  if (legacy) {
    project = json.project ?? {};
    if (json.name) {
      project.name = json.name;
    }

    // prettier-ignore
    const {
      formats,
      dirs,
      project: _ /* ignore!*/,
      name,
      collections: flatCollections,
      ...rest
    } = json;

    // Collections live at the top level, but may be in a legacy project block
    collections = flatCollections ?? project.collections;

    workspace = pickBy(
      {
        ...rest,
        formats,
        dirs,
      },
      (value: unknown) => !isNil(value)
    );
  } else {
    project = json.project ?? {};
    workspace = json.workspace ?? {};
    collections = project.collections;
  }

  return { project, workspace, collections };
};

export const findWorkspaceFile = (dir: string = '.') => {
  let content, type;
  try {
    type = 'yaml';
    content = readFileSync(path.resolve(path.join(dir, 'openfn.yaml')), 'utf8');
  } catch (e) {
    // Not found - try and parse as JSON
    try {
      type = 'json';
      const file = readFileSync(path.join(dir, 'openfn.json'), 'utf8');
      if (file) {
        content = JSON.parse(file);
      }
    } catch (e) {
      // console.log(e);
      // TODO better error handling
      throw e;
    }
  }
  return { content, type };
};

// Does this workspace know which project is checked out?
// True if there's checkout metadata in the checkout file, or in a legacy
// project block in openfn.yaml. An empty checkout file doesn't count
export const hasCheckoutMeta = (
  root: string = '.',
  branch?: string | false | null
) => {
  let legacyProject: l.ProjectMeta | undefined;
  try {
    const { type, content } = findWorkspaceFile(root);
    legacyProject = loadWorkspaceFile(content, type as any).project;
  } catch (e) {
    // No workspace file: there can't be a legacy project block
  }

  const meta = loadCheckoutFile(root, branch, legacyProject);
  return !!meta && Object.keys(meta).length > 0;
};
