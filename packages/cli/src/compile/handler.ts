import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import chokidar from 'chokidar';
import { Workspace } from '@openfn/project';
import type { CompileOptions } from './command';
import type { Logger } from '../util/logger';

import compile, { compileProject } from './compile';
import loadPlan from '../util/load-plan';
import assertPath from '../util/assert-path';

// True if the input path points to a file (workflow or expression),
// rather than a workflow name or nothing at all.
// See the input-path option, which maps file paths by extension.
const isFileInput = (options: CompileOptions) =>
  Boolean(options.planPath || options.expressionPath);

const collectWatchOptions = (options: CompileOptions, logger: Logger) => {
  const ignored = ['**/node_modules/**'];

  if (options.expressionPath) {
    return { targets: [path.resolve(options.expressionPath)], ignored };
  }
  if (options.path && isFileInput(options)) {
    return { targets: [path.resolve(options.path)], ignored };
  }

  // Project mode: watch job files in the workspace's configured workflows dir
  // and ignore the compiled output dir
  const workspace = new Workspace(options.workspace!, logger as any, false);
  const outDir = path.resolve(
    options.workspace!,
    options.outputPath ?? workspace.getConfig().dirs?.compiled ?? 'dist'
  );
  return {
    targets: [path.join(workspace.workflowsPath, '**', '*.js')],
    ignored: [...ignored, path.join(outDir, '**')],
  };
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
  if (isFileInput(options)) {
    assertPath(options.expressionPath ?? options.planPath);
    await doCompile(options, logger);
  } else {
    // No path, or a bare workflow name: compile the checked-out project,
    // optionally filtered to a single workflow
    await compileProject(
      options,
      logger,
      options.workspace!,
      options.workflowName
    );
  }
};

const compileHandler = async (options: CompileOptions, logger: Logger) => {
  await runCompile(options, logger);

  if (!options.watch) return;

  const { targets, ignored } = collectWatchOptions(options, logger);
  logger.info(`Watching for changes. Ctrl+C to stop.`);

  const watcher = chokidar.watch(targets, {
    ignoreInitial: true,
    ignored,
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
