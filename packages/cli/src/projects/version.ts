import fs from 'node:fs/promises';
import yargs from 'yargs';
import { Workspace, yamlToJson, generateVersionHash } from '@openfn/project';

import { ensure, build } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';
import * as po from './options';

import type { Opts } from './options';

export type VersionOptions = Required<
  Pick<
    Opts,
    | 'command'
    | 'workflow'
    | 'workspace'
    | 'workflowMappings'
    | 'json'
    | 'log'
    | 'branch'
  >
>;

const options = [
  o.workflow,
  o.log,
  po.workspace,
  po.branch,
  po.workflowMappings,
];

const command: yargs.CommandModule = {
  command: 'version [workflow]',
  describe:
    'Returns the version hash of a workflow. Pass a workflow id in the checked-out project, a path to a workflow yaml/json file, or pipe workflow content via stdin',
  handler: ensure('project-version', options),
  builder: (yargs) =>
    build(options, yargs)
      .example(
        'version',
        'Print version hashes for every workflow in the checked-out project'
      )
      .example(
        'version my-workflow',
        'Print the version hash of workflow "my-workflow" in the checked-out project'
      )
      .example(
        'version my-workflow.yaml',
        'Print the version hash of a standalone workflow yaml/json file'
      )
      .example(
        'xclip -selection clipboard -o | openfn project version',
        'Print the version hash of workflow content piped in via stdin'
      ),
};

export default command;

// Some workflow files wrap the workflow in a { workflow, options } envelope
const asWorkflow = (json: any) => json.workflow ?? json;

const hashWorkflow = (json: any) => {
  const workflow = asWorkflow(json);
  const name = workflow.name || workflow.id || 'workflow';
  return { name, hash: generateVersionHash(workflow) };
};

const readStdin = () =>
  new Promise<string>((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });

const printHash = (logger: Logger, name: string, hash: string) => {
  logger.success(`Workflow(s) and their hashes\n\n${name}\n${hash}`);
};

export const handler = async (options: VersionOptions, logger: Logger) => {
  // A workflow file passed directly, e.g. `openfn project version my-workflow.yaml`
  if (options.workflow && /\.(ya?ml|json)$/i.test(options.workflow)) {
    logger.debug(`Reading workflow from file: ${options.workflow}`);
    const content = await fs.readFile(options.workflow, 'utf8');
    const json = options.workflow.toLowerCase().endsWith('.json')
      ? JSON.parse(content)
      : yamlToJson(content);
    const { name, hash } = hashWorkflow(json);
    printHash(logger, name, hash);
    return;
  }

  // Workflow content piped through stdin, e.g. `pbpaste | openfn project version`
  if (!options.workflow && !process.stdin.isTTY) {
    logger.debug('Reading workflow from stdin');
    const content = await readStdin();
    if (content.trim()) {
      const json = content.trim().startsWith('{')
        ? JSON.parse(content)
        : yamlToJson(content);
      const { name, hash } = hashWorkflow(json);
      printHash(logger, name, hash);
      return;
    }
  }

  logger.debug('Reading workflow(s) from checked-out workspace project');
  const workspace = new Workspace(options.workspace, undefined, true, {
    branch: options.branch,
  });
  if (!workspace.valid) {
    logger.error('Command was run in an invalid openfn workspace');
    return;
  }

  const output = new Map<string, string>();

  const activeProject = await workspace.getCheckedOutProject();
  if (options.workflow) {
    const workflow = activeProject?.getWorkflow(options.workflow);
    if (!workflow) {
      logger.error(`No workflow found with id ${options.workflow}`);
      return;
    }
    output.set(workflow.name || workflow.id, workflow.getVersionHash());
  } else {
    for (const wf of activeProject?.workflows || []) {
      output.set(wf.name || wf.id, wf.getVersionHash());
    }
  }
  if (!output.size) {
    logger.error('No workflow available');
    return;
  }

  let final: string;
  if (options.json) {
    final = JSON.stringify(Object.fromEntries(output), undefined, 2);
  } else {
    final = Array.from(output.entries())
      .map(([key, value]) => key + '\n' + value)
      .join('\n\n');
  }
  logger.success(`Workflow(s) and their hashes\n\n${final}`);
};
