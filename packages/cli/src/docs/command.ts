import yargs from 'yargs';
import * as o from '../options';
import type { Opts } from '../options';
import { build, ensure } from '../util/command-builders';

type DocsOptions = Partial<Pick<Opts, 'log' | 'logJson' | 'repoDir'>>;

const options = [o.log, o.logJson, o.repoDir];

const docsCommand: yargs.CommandModule<DocsOptions> = {
  command: 'docs <adaptor> [operation]',
  describe:
    'Print help for an adaptor function. You can use short-hand for adaptor names (ie, common instead of @openfn/language-common)',
  handler: ensure('docs', options),
  builder: (yargs) =>
    build(options, yargs).example(
      'docs common fn',
      'Print help for the common fn operation'
    ),
};

export default docsCommand;
