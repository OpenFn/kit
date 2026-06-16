import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import chokidar from 'chokidar';
import type { CompileOptions } from './command';
import type { Logger } from '../util/logger';

import compile, { compileProject } from './compile';
import loadPlan from '../util/load-plan';
import assertPath from '../util/assert-path';

const collectWatchTargets = (options: CompileOptions): string[] => {
  if (options.expressionPath) {
    return [path.resolve(options.expressionPath)];
  }
  if (options.path) {
    return [path.resolve(options.path)];
  }
  return [path.join(process.cwd(), 'workflows', '**', '*.js')];
};

const doCompile = async (options: CompileOptions, logger: Logger) => {
  let result: string;
  if (options.expressionPath) {
    const { code } = await compile(options.expressionPath, options, logger);
    result = code;
  } else {
    const plan = await loadPlan(options, logger);
    const compiledPlan = await compile(plan, options, logger);
    result = JSON.stringify(compiledPlan, null, 2);
  }

  if (options.outputPath) {
    await mkdir(path.dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, result);
    logger.success(`Compiled to ${options.outputPath}`);
  } else {
    logger.success('Result:\n\n' + result);
  }
};

const runCompile = async (options: CompileOptions, logger: Logger) => {
  if (options.workflowName) {
    await compileProject(options, logger, process.cwd(), options.workflowName);
  } else if (!options.path) {
    await compileProject(options, logger);
  } else {
    assertPath(options.path);
    await doCompile(options, logger);
  }
};

const compileHandler = async (options: CompileOptions, logger: Logger) => {
  await runCompile(options, logger);

  if (!options.watch) return;

  const watchTargets = collectWatchTargets(options);
  logger.info(`Watching for changes. Ctrl+C to stop.`);

  const watcher = chokidar.watch(watchTargets, {
    ignoreInitial: true,
    ignored: ['**/node_modules/**', '**/compiled/**'],
  });

  watcher.on('change', async (changedPath: string) => {
    logger.info(`${changedPath} changed, recompiling...`);
    try {
      await runCompile(options, logger);
    } catch (e) {
      logger.error('Compilation error:', e);
    }
  });

  // Keep the process alive
  await new Promise<void>(() => {});
};

export default compileHandler;
