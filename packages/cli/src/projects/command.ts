import yargs from 'yargs';
import { Opts } from '../options';
import { ensure, build } from '../util/command-builders';
import * as o from '../options';

export type ProjectsOptions = Required<Pick<Opts, 'command' | 'projectPath'>>;

const options = [o.projectPath];

const projectsCommand: yargs.CommandModule = {
  command: 'projects [project-path]',
  describe: 'List all the openfn projects available in the current directory',
  handler: ensure('projects', options),
  builder: (yargs) => build(options, yargs),
};

export default projectsCommand;
