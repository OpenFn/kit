import yargs from 'yargs';
import { Opts } from '../options';
import * as o from '../options';
import { build, ensure, override } from '../util/command-builders';

export type CompileOptions = Required<
  Pick<
    Opts,
    | 'adaptors'
    | 'command'
    | 'expandAdaptors'
    | 'ignoreImports'
    | 'jobPath'
    | 'logJson'
    | 'log'
    | 'outputPath'
    | 'outputStdout'
    | 'path'
    | 'useAdaptorsMonorepo'
  >
> & {
  repoDir?: string;
  jobSource?: string; // accept jobs as a string of code (internal use only)
};

const options = [
  o.expandAdaptors, // order important
  o.adaptors,
  o.ignoreImports,
  o.jobPath,
  o.logJson,
  override(o.outputStdout, {
    default: true,
  }),
  o.outputPath,
  o.useAdaptorsMonorepo,
];

const compileCommand = {
  command: 'compile [path]',
  desc: 'Compile an openfn job and print or save the resulting JavaScript.',
  handler: ensure('compile', options),
  builder: (yargs) =>
    build(options, yargs)
      .positional('path', {
        describe:
          'The path to load the job from (a .js file or a dir containing a job.js file)',
        demandOption: true,
      })
      .example(
        'compile foo/job.js -O',
        'Compiles foo/job.js and prints the result to stdout'
      )
      .example(
        'compile foo/job.js -o foo/job-compiled.js',
        'Compiles foo/job.js and saves the result to foo/job-compiled.js'
      ),
} as yargs.CommandModule<CompileOptions>;

export default compileCommand;
