import yargs from 'yargs';
import { hideBin } from 'yargs/helpers'
import { Opts } from './execute';
import runInChildProcess from './process';

type YargsOpts = Opts & { 
  path: string;
  _: string[];
}

const opts = yargs(hideBin(process.argv))
  .command('openfn [path]' , "Run the job at the provided path")

  .example('openfn path/to/dir', 'Looks for job.js, state.json in path/to/dir')
  .example('openfn path/to/job.js', 'Reads job.js, looks for state next to it, and outputs next to it')
  .positional('path', {
    describe: 'The path to load the job from'
  })
  .option('job-path', {
    alias: 'j',
    boolean: true,
    description: 'Path to the job file',
  })
  .alias('j', 'e') // job & expression are interchangeable
  .option('output-path', {
    alias: 'o',
    description: 'Path to the output file',
  })
  .option('output-stdout', {
    alias: 'O',
    boolean: true,
    description: 'Output to stdout',
  })
  .option('state', {
    alias: 's',
    description: 'Path to the state file'
  })
  .option('state-stdin', {
    alias: 'S',
    description: 'Read state from stdin'
  })
  .option('no-validation', {
    boolean: true,
    description: 'Skip validation'
  })
  .option('no-compile', {
    boolean: true,
    description: 'Skip compilation'
  })
  .option('adaptor', {
    description: 'adaptor-name:path/to/adaptor'
  })
  .parse() as YargsOpts;

// If all inputs have parsed OK, we can go ahead and run in a child process
runInChildProcess(opts._[0], opts);