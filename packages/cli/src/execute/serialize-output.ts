import { mkdir, writeFile } from 'node:fs/promises';
import { Logger } from '../util/logger';
import { Opts } from '../options';
import { dirname } from 'node:path';

const serializeOutput = async (
  options: Pick<Opts, 'outputStdout' | 'outputPath' | 'log'>,
  result: any,
  logger: Logger
) => {
  let output = result;
  if (output && (output.configuration || output.data)) {
    const { configuration, ...rest } = result;
    output = rest;
  }

  if (output === undefined) {
    output = '';
  } else {
    output = JSON.stringify(output, undefined, 2);
  }

  if (options.outputStdout) {
    logger.success(`Result: `);
    if (options.log?.default === 'none') {
      // special case because if we use logger.always the output won't be seen
      console.log(output);
    } else {
      logger.always(output);
    }
  } else if (options.outputPath) {
    await mkdir(dirname(options.outputPath), { recursive: true });

    logger.debug(`Writing output to ${options.outputPath}`);
    await writeFile(options.outputPath, output);
    logger.success(`State written to ${options.outputPath}`);
  }

  return output;
};

export default serializeOutput;
