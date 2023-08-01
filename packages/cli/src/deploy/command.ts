import yargs from 'yargs';
import { build, ensure } from '../util/command-builders';
import { Opts } from '../options';
import * as o from '../options';

export type DeployOptions = Required<
  Pick<
    Opts,
    | 'command'
    | 'log'
    | 'logJson'
    | 'statePath'
    | 'projectPath'
    | 'configPath'
    | 'confirm'
  >
>;

const options = [
  o.statePath,
  o.projectPath,
  o.configPath,
  o.confirm,
  o.describe,
];

const deployCommand: yargs.CommandModule<DeployOptions> = {
  command: 'deploy',
  describe: "Deploy a project's config to a remote Lightning instance",
  handler: ensure('deploy', options),
  builder: (yargs) => build(options, yargs),
};

export default deployCommand;
