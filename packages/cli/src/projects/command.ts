import yargs from 'yargs';
import { Opts } from '../options';
import { ensure, build } from '../util/command-builders';
import * as o from '../options';

import list from './list';

export const projectsCommand = {
  command: 'project [subcommand]',
  aliases: ['projects'],
  describe: 'Sync and manage an OpenFn project',
  handler: () => {},
  builder: (yargs: yargs.Argv) =>
    yargs
      // .command(clean)
      // .command(install)
      .command(list)
      .example('project', 'list all projects in the workspace')
      .example('project list', 'list all projects in the workspace'),
} as yargs.CommandModule<{}>;

export default projectsCommand;
