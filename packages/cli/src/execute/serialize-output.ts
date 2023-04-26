import { writeFile } from 'node:fs/promises';
import { Logger } from '../util/logger';
import { Opts } from '../options';

const serializeOutput = async (
  options: Pick<Opts, 'strict' | 'outputStdout' | 'outputPath'>,
  result: any,
  logger: Logger
) => {
  let output = result;
  if (output && (output.configuration || output.data)) {
    if (options.strict) {
      output = { data: output.data };
    } else {
      const { configuration, ...rest } = result;
      output = rest;
    }
  }

  if (output === undefined) {
    output = '';
  } else {
    output = JSON.stringify(output, undefined, 2);
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

export default serializeOutput;
