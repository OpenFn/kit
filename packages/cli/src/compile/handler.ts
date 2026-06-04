import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import chokidar from 'chokidar';
import { Workspace } from '@openfn/project';
import type { CompileOptions } from './command';
import type { Logger } from '../util/logger';

import compile, { compileProject } from './compile';
import loadPlan from '../util/load-plan';
import assertPath from '../util/assert-path';

// Returns false when compiled strip output has no declarations worth importing in tests.
export const hasExportableCode = (code: string): boolean =>
  /^\s*(export\s+(const|let|var|function|class)|const|let|var|function|class)\s/m.test(code);

export const deriveTestOutputPath = (
  expressionPath: string,
  compiledDir: string,
  workflowsDir: string,
  cwd = process.cwd()
): string => {
  const absInput = path.resolve(cwd, expressionPath);
  const absWorkflows = path.resolve(cwd, workflowsDir);
  if (absInput.startsWith(absWorkflows + path.sep)) {
    return path.resolve(cwd, compiledDir, path.relative(absWorkflows, absInput));
  }
  return path.resolve(cwd, compiledDir, path.basename(expressionPath));
};

// Derive the watch target(s) from the compile options.
// Returns either file paths or directory globs that chokidar can watch.
const collectWatchTargets = (options: CompileOptions): string[] => {
  if (options.expressionPath) {
    return [path.resolve(options.expressionPath)];
  }
  if (options.path) {
    // Workflow/plan mode: watch the workflow file
    return [path.resolve(options.path)];
  }
  // Project mode: watch the entire workflows directory for .js changes
  return [path.join(process.cwd(), 'workflows', '**', '*.js')];
};

// Run a single compilation pass and write output based on options.
const doCompile = async (options: CompileOptions, logger: Logger) => {
  if (!options.path) {
    await compileProject(options, logger);
    return;
  }

  let result: string;
  if (options.expressionPath) {
    const { code } = await compile(options.expressionPath, options, logger);
    result = code;
  } else {
    const plan = await loadPlan(options, logger);
    const compiledPlan = await compile(plan, options, logger);
    result = JSON.stringify(compiledPlan, null, 2);
  }

  let outputPath = options.outputPath;
  let outputStdout = options.outputStdout;

  if (options.test && outputStdout && options.expressionPath) {
    const cwd = process.cwd();
    const workspace = new Workspace(cwd, logger as any, false);
    const wsConfig = workspace.getConfig() as any;
    const compiledDir = wsConfig?.dirs?.tests ?? 'tests';
    const workflowsDir = wsConfig?.dirs?.workflows ?? 'workflows';
    outputPath = deriveTestOutputPath(options.expressionPath, compiledDir, workflowsDir, cwd);
    outputStdout = false;
  }

  if (options.test && options.strip !== false && !hasExportableCode(result)) {
    logger.info(`Skipped ${outputPath ?? options.expressionPath} — no exportable code after stripping`);
    return;
  }

  if (outputStdout) {
    logger.success('Result:\n\n' + result);
  } else {
    await mkdir(path.dirname(outputPath!), { recursive: true });
    await writeFile(outputPath!, result);
    logger.success(`Compiled to ${outputPath}`);
  }
};

const compileHandler = async (options: CompileOptions, logger: Logger) => {
  if (!options.path) {
    // Project mode: no path given, compile all workflows in the current project
    await compileProject(options, logger);
  } else {
    assertPath(options.path);
    await doCompile(options, logger);
  }

  if (!options.watch) return;

  const watchTargets = collectWatchTargets(options);
  logger.info(`Watching for changes. Ctrl+C to stop.`);

  const watcher = chokidar.watch(watchTargets, {
    ignoreInitial: true,
    ignored: ['**/node_modules/**', '**/tests/**', '**/compiled/**'],
  });

  watcher.on('change', async (changedPath) => {
    logger.info(`${changedPath} changed, recompiling...`);
    try {
      await doCompile(options, logger);
    } catch (e) {
      logger.error('Compilation error:', e);
    }
  });

  // Keep the process alive
  await new Promise<void>(() => {});
};

export default compileHandler;
