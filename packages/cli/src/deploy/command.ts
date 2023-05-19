import yargs, { Arguments } from 'yargs';
import { ensure } from '../util/command-builders';
import { Opts } from '../options';
import * as o from '../options';

export type DeployOptions = Required<
  Pick<
    Opts,
    'command' | 'log' | 'logJson' | 'statePath' | 'projectPath' | 'configPath'
  >
>;

const options = [o.logJson, o.statePath, o.projectPath, o.configPath];

const deployCommand = {
  command: 'deploy',
  desc: "Deploy a project's config to a remote Lightning instance",
  handler: ensure('deploy', options),
  builder: (yargs: yargs.Argv) => {
    return yargs.example('deploy', '');
  },
} as yargs.CommandModule<DeployOptions>;

export default deployCommand;
