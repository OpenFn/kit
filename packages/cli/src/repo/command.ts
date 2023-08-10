import yargs from 'yargs';
import * as o from '../options';
import { build, ensure, override } from '../util/command-builders';

export const repo = {
  command: 'repo [subcommand]',
  describe: 'Run commands on the module repo (install|clean)',
  builder: (yargs: yargs.Argv) =>
    yargs
      .command(clean)
      .command(install)
      .command(list)
      .example('repo install -a http', 'Install @openfn/language-http')
      .example('repo clean', 'Remove everything from the repo working dir'),
} as yargs.CommandModule<{}>;

const installOptions = [
  o.log,
  o.logJson,
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
  describe:
    'install one or more packages to the runtime repo. Use -a to pass shorthand adaptor names.',
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

const cleanOptions = [
  o.log,
  o.logJson,
  o.repoDir,
  {
    name: 'force',
    yargs: {
      alias: ['f'],
      description: 'Skip the prompt and force deletion',
      boolean: true,
    },
  },
];

export const clean = {
  command: 'clean',
  describe: 'Removes all modules from the runtime module repo',
  handler: ensure('repo-clean', cleanOptions),
  builder: (yargs) => build(cleanOptions, yargs),
} as yargs.CommandModule<{}>;

const listOptions = [o.repoDir, o.log, o.logJson];
export const list = {
  command: 'list',
  describe: 'Show a report on what is installed in the repo',
  aliases: ['$0'],
  handler: ensure('repo-list', listOptions),
  builder: (yargs) => build(listOptions, yargs),
} as yargs.CommandModule<{}>;
