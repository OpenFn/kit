// when given a file path from cli it'll create a workspace object
import { OpenfnConfig, Project } from './Project';
import pathExists from './util/path-exists';
import { yamlToJson } from './util/yaml';
import path from 'path';
import fs from 'fs';
import fromAppState from './parse/from-app-state';

const PROJECTS_DIRECTORY = '.projects';
const OPENFN_YAML_FILE = 'openfn.yaml';
const PROJECT_EXTENSIONS = ['.yaml', '.yml'];

export class Workspace {
  private config?: OpenfnConfig;
  private projects: Project[];
  private isValid: boolean = false;
  constructor(workspacePath: string) {
    const projectsPath = path.join(workspacePath, PROJECTS_DIRECTORY);
    const openfnYamlPath = path.join(workspacePath, OPENFN_YAML_FILE);

    // dealing with openfn.yaml
    if (pathExists(openfnYamlPath, 'file')) {
      this.isValid = true;
      const data = fs.readFileSync(openfnYamlPath, 'utf-8');
      this.config = yamlToJson(data);
    }

    // dealing with projects
    if (this.isValid && pathExists(projectsPath, 'directory')) {
      const stateFiles = fs
        .readdirSync(projectsPath)
        .filter((fileName) =>
          PROJECT_EXTENSIONS.includes(path.extname(fileName))
        );

      this.projects = stateFiles.map((file) => {
        const data = fs.readFileSync(path.join(projectsPath, file), 'utf-8');
        return fromAppState(data, { format: 'yaml' });
      });
    }
  }

  list() {
    return this.projects;
  }

  get(id: string) {
    return this.projects.find((p) => p.name === id);
  }

  getActiveProject() {
    return this.projects.find((p) => p.name === this.config?.name);
  }

  getConfig() {
    return this.config;
  }

  get activeProjectId() {
    return this.config?.name;
  }

  get valid() {
    return this.isValid;
  }
}
