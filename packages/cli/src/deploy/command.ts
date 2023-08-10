import yargs from 'yargs';
import { build, ensure } from '../util/command-builders';
import { Opts } from '../options';
import * as o from '../options';

export type DeployOptions = Required<
  Pick<
    Opts,
    | 'command'
    | 'configPath'
    | 'confirm'
    | 'log'
    | 'logJson'
    | 'projectPath'
    | 'statePath'
  >
>;

const options = [
  o.configPath,
  o.confirm,
  o.describe,
  o.log,
  o.logJson,
  o.projectPath,
  o.statePath,
];

const deployCommand: yargs.CommandModule<DeployOptions> = {
  command: 'deploy',
  describe: "Deploy a project's config to a remote Lightning instance",
  handler: ensure('deploy', options),
  builder: (yargs) => build(options, yargs),
};

export default deployCommand;
