import { writeFile } from 'node:fs/promises';
import type { CompileOptions } from './command';
import type { Logger } from '../util/logger';

import compile from './compile';
import loadPlan from '../util/load-plan';
import assertPath from '../util/assert-path';

const compileHandler = async (options: CompileOptions, logger: Logger) => {
  assertPath(options.path);

  let result;
  if (options.expressionPath) {
    const { code } = await compile(options.expressionPath, options, logger);
    result = code;
  } else {
    const plan = await loadPlan(options, logger);
    const compiledPlan = await compile(plan, options, logger);
    result = JSON.stringify(compiledPlan, null, 2);
  }

  if (options.outputStdout) {
    logger.success('Result:\n\n' + result);
  } else {
    await writeFile(options.outputPath!, result as string);
    logger.success(`Compiled to ${options.outputPath}`);
  }
};

export default compileHandler;
