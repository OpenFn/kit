import yargs from 'yargs';
import { build, ensure, override } from '../util/command-builders';
import { Opts } from '../options';
import * as o from '../options';
import * as o2 from '../projects/options';

export type DeployOptions = Required<
  Pick<
    Opts,
    | 'beta'
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
  o.beta,
  o.configPath,
  o.confirm,
  o.describe,
  o.log,
  o.logJson,
  o.projectPath,
  o.statePath,

  override(o2.workspace, { hidden: true }),
];

const deployCommand: yargs.CommandModule<DeployOptions> = {
  command: 'deploy',
  describe: "Deploy a project's config to a remote Lightning instance",
  handler: ensure('deploy', options),
  builder: (yargs) => build(options, yargs),
};

export default deployCommand;
