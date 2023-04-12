import { writeFile } from 'node:fs/promises';
import type { CompileOptions } from './command';
import type { Logger } from '../util/logger';

import compile from './compile';
import loadInput from '../util/load-input';

const compileHandler = async (options: CompileOptions, logger: Logger) => {
  await loadInput(options, logger);
  let result = await compile(options, logger);
  if (options.workflow) {
    result = JSON.stringify(result);
  }
  if (options.outputStdout) {
    logger.success('Compiled code:');
    logger.success('\n' + result);
  } else {
    await writeFile(options.outputPath!, result);
    logger.success(`Compiled to ${options.outputPath}`);
  }
};

export default compileHandler;
