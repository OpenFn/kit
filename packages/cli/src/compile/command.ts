import yargs from 'yargs';
import { Opts } from '../options';
import * as o from '../options';
import { build, ensure, override } from '../util/command-builders';

export type CompileOptions = Pick<
  Opts,
  | 'adaptors'
  | 'command'
  | 'expandAdaptors'
  | 'ignoreImports'
  | 'jobPath'
  | 'job'
  | 'logJson'
  | 'log'
  | 'outputPath'
  | 'outputStdout'
  | 'repoDir'
  | 'path'
  | 'useAdaptorsMonorepo'
  | 'workflow'
> & {
  repoDir?: string;
};

const options = [
  o.expandAdaptors, // order important
  o.adaptors,
  o.ignoreImports,
  o.inputPath,
  o.log,
  o.logJson,
  override(o.outputStdout, {
    default: true,
  }),
  o.outputPath,
  o.repoDir,
  o.useAdaptorsMonorepo,
];

const compileCommand: yargs.CommandModule<CompileOptions> = {
  command: 'compile [path]',
  describe:
    'Compile an openfn job or workflow and print or save the resulting JavaScript.',
  handler: ensure('compile', options),
  builder: (yargs) =>
    build(options, yargs)
      .positional('path', {
        describe:
          'The path to load the job or workflow from (a .js or .json file or a dir containing a job.js file)',
        demandOption: true,
      })
      .example(
        'compile foo/job.js',
        'Compiles the job at foo/job.js and prints the result to stdout'
      )
      .example(
        'compile foo/workflow.json -o foo/workflow-compiled.json',
        'Compiles the workflow at foo/work.json and prints the result to -o foo/workflow-compiled.json'
      ),
};

export default compileCommand;
