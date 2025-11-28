import yargs from 'yargs';

import list from './list';
import version from './version';
import merge from './merge';

export const projectsCommand = {
  command: 'project [subcommand]',
  aliases: ['projects'],
  describe: 'Sync and manage an OpenFn project',
  handler: () => {},
  builder: (yargs: yargs.Argv) =>
    yargs
      .command(list)
      .command(version)
      .command(merge)
      .example('project', 'list all projects in the workspace')
      .example('project list', 'list all projects in the workspace'),
} as yargs.CommandModule<{}>;

export default projectsCommand;
