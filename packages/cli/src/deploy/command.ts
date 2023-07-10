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
    | 'describe'
  >
>;

const options = [o.statePath, o.projectPath, o.configPath, o.confirm, o.describe];

const deployCommand = {
  command: 'deploy',
  desc: "Deploy a project's config to a remote Lightning instance",
  builder: (yargs: yargs.Argv<DeployOptions>) => {
    return build(options, yargs).example('deploy', '');
  },
  handler: ensure('deploy', options),
};

export default deployCommand;
