import yargs, { Arguments } from 'yargs';
import { Opts } from '../commands';

export const repo = {
  command: 'repo [subcommand]',
  desc: 'Run commands on the module repo (install|clean)',
  builder: (yargs: yargs.Argv) =>
    yargs
      .command(clean)
      .command(install)
      .command(pwd)
      .example('repo install -a http', 'Install @openfn/language-http')
      .example('repo clean', 'Remove everything from the repo working dir')
      .example('repo pwd', 'Print the current repo working dir'),
} as unknown as yargs.CommandModule<{}>;

export const install = {
  command: 'install [packages...]',
  desc: 'install one or more packages to the runtime repo',
  handler: (argv: Arguments<Opts>) => {
    argv.command = 'repo-install';
  },
  builder: (yargs: yargs.Argv) => {
    return yargs
      .option('adaptor', {
        alias: ['a'],
        description:
          'Install an adaptor by passing a shortened version of the name',
        boolean: true,
      })
      .example('install axios', 'Install the axios npm package to the repo')
      .example(
        'install -a http',
        'Install @openfn/language-http adaptor to the repo'
      )
      .example(
        'install @openfn/language-http',
        'Install the language-http adaptor to the repo'
      );
  },
} as yargs.CommandModule<{}>;

export const clean = {
  command: 'clean',
  desc: 'Removes all modules from the runtime module repo',
  handler: (argv: Arguments<Opts>) => {
    argv.command = 'repo-clean';
  },
} as yargs.CommandModule<{}>;

export const pwd = {
  command: 'pwd',
  desc: "Print repo's current working directory",
  handler: (argv: Arguments<Opts>) => {
    argv.command = 'repo-pwd';
  },
} as yargs.CommandModule<{}>;
