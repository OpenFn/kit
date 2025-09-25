import yargs from 'yargs';
import { Opts } from '../options';
import { ensure, build } from '../util/command-builders';
import * as o from '../options';

export type CheckoutOptions = Required<
  Pick<Opts, 'command' | 'projectId' | 'projectPath'>
>;

const options: o.CLIOption[] = [o.projectId, o.projectPath];

const checkoutCommand: yargs.CommandModule = {
  command: 'checkout <project-id>',
  describe:
    'Switches between available openfn projects & expands workflow to the filesystem',
  handler: ensure('checkout', options),
  builder: (yargs) => build(options, yargs),
};

export default checkoutCommand;
