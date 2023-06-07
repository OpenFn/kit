import yargs, { Argv } from 'yargs';
import { build, ensure, override } from '../util/command-builders';
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
  o.logJson,
  override(o.statePath, {
    default: './.state.json',
  }),
  o.projectPath,
  override(o.configPath, {
    default: './.config.json',
  }),
  o.confirm,
];

const deployCommand = {
  command: 'deploy',
  desc: "Deploy a project's config to a remote Lightning instance",
  builder: (yargs: yargs.Argv<DeployOptions>) => {
    return build(options, yargs).example('deploy', '');
  },
  handler: ensure('deploy', options),
};

export default deployCommand;
