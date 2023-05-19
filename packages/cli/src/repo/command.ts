import yargs from 'yargs';
import * as o from '../options';
import { build, ensure, override } from '../util/command-builders';

export const repo = {
  command: 'repo [subcommand]',
  desc: 'Run commands on the module repo (install|clean)',
  builder: (yargs: yargs.Argv) =>
    yargs
      .command(clean)
      .command(install)
      .command(pwd)
      .command(list)
      .example('repo install -a http', 'Install @openfn/language-http')
      .example('repo clean', 'Remove everything from the repo working dir')
      .example('repo pwd', 'Print the current repo working dir'),
} as unknown as yargs.CommandModule<{}>;

const installOptions = [
  o.repoDir,
  override(o.expandAdaptors, {
    default: true,
    hidden: true,
  }),
  override(o.adaptors, {
    description:
      'Specify which language-adaptor to install (allows short-form names to be used, eg, http)',
  }),
];

export const install = {
  command: 'install [packages...]',
  desc: 'install one or more packages to the runtime repo. Use -a to pass shorthand adaptor names.',
  handler: ensure('repo-install', installOptions),
  builder: (yargs) =>
    build(installOptions, yargs)
      .example('install axios', 'Install the axios npm package to the repo')
      .example(
        'install -a http',
        'Install @openfn/language-http adaptor to the repo'
      )
      .example(
        'install @openfn/language-http',
        'Install the language-http adaptor to the repo'
      ),
} as yargs.CommandModule<{}>;

export const clean = {
  command: 'clean',
  desc: 'Removes all modules from the runtime module repo',
  handler: ensure('repo-clean', [o.repoDir]),
  builder: (yargs) =>
    build(
      [
        o.repoDir,
        {
          name: 'force',
          yargs: {
            alias: ['f'],
            description: 'Skip the prompt and force deletion',
            boolean: true,
          },
        },
      ],
      yargs
    ),
} as yargs.CommandModule<{}>;

export const pwd = {
  command: 'pwd',
  desc: "Print repo's current working directory",
  handler: ensure('repo-pwd', []),
} as yargs.CommandModule<{}>;

export const list = {
  command: 'list',
  desc: 'Show a report on what is installed in the repo',
  handler: ensure('repo-list', [o.repoDir]),
  builder: (yargs) => build([o.repoDir], yargs),
} as yargs.CommandModule<{}>;
