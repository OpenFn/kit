import { writeFile } from 'node:fs/promises';
import { Logger, printDuration } from '../util/logger';
import loadState from './load-state';
import execute from './execute';
import compile from '../compile/compile';
import { install } from '../repo/handler';
import { Opts, SafeOpts } from '../commands';

const executeHandler = async (options: SafeOpts, logger: Logger) => {
  const start = new Date().getTime();

  // auto install the language adaptor
  if (options.autoinstall) {
    const { repoDir } = options;
    logger.info('Auto-installing language adaptors');
    await install({ packages: options.adaptors, repoDir }, logger);
  }

  const state = await loadState(options, logger);
  const code = await compile(options, logger);
  const result = await execute(code, state, options);

  await handleOutput(options, logger, result);

  const duration = printDuration(new Date().getTime() - start);
  logger.success(`Done in ${duration}! ✨`);
};

export const handleOutput = async (
  options: Pick<Opts, 'noStrictOutput' | 'outputStdout' | 'outputPath'>,
  result: any,
  logger: Logger
) => {
  let output = result;
  if (output && (output.configuration || output.data)) {
    // handle an object. Probably need a better test.
    const { data, configuration, ...rest } = result;
    if (options.noStrictOutput) {
      // if not in strict mode, we can write everything to the output
      // except config?
      output = {
        data,
        ...rest,
      };
    } else {
      output = { data };
    }
    // Now stringify
    output = JSON.stringify(output, null, 2);
  }

  if (options.outputStdout) {
    logger.success(`Result: `);
    logger.success(output);
  } else if (options.outputPath) {
    logger.success(`Writing output to ${options.outputPath}`);
    await writeFile(options.outputPath, output);
  }

  return output;
};

export default executeHandler;
