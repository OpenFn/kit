import yargs from 'yargs';
import { Opts } from '../options';
import { ensure, build } from '../util/command-builders';
import * as o from '../options';

export type CheckoutOptions = Required<
  Pick<Opts, 'command' | 'projectName' | 'projectPath'>
> &
  Pick<Opts, 'log'>;

const options = [o.projectName, o.projectPath, o.log];

const checkoutCommand: yargs.CommandModule = {
  command: 'checkout <project-name>',
  describe: 'Switch to a different openfn project in the same workspace',
  handler: ensure('checkout', options),
  builder: (yargs) => build(options, yargs),
};

export default checkoutCommand;
