import yargs from 'yargs';
import { Opts } from '../options';
import { ensure, build } from '../util/command-builders';
import * as o from '../options';

export type VersionOptions = Required<
  Pick<
    Opts,
    | 'command'
    | 'workflow'
    | 'projectName'
    | 'projectPath'
    | 'workflowMappings'
    | 'json'
  >
>;

const options = [
  o.workflow,
  o.projectName,
  o.projectPath,
  o.workflowMappings,
  o.json,
];

const workflowVersionCommand: yargs.CommandModule = {
  command: 'project version [workflow]',
  describe: 'Returns the version has of a workflow',
  handler: ensure('project', options),
  builder: (yargs) => build(options, yargs),
};

export default workflowVersionCommand;
