import list from './list';
import version from './version';
import merge from './merge';
import checkout from './checkout';

import type yargs from 'yargs';

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
      .command(checkout)
      .example('project', 'list all projects in the workspace')
      .example('project list', 'list all projects in the workspace')
      .example(
        'project checkout staging',
        'Checkout the project with id staging'
      )
      .example(
        'project merge staging',
        'Merge staging into the checkout-out branch'
      )
      .example(
        'project merge staging',
        'Merge staging into the checkout-out branch'
      ),
} as yargs.CommandModule<{}>;

export default projectsCommand;
