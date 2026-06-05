import path from 'node:path';
import fs from 'node:fs/promises';
import compile, {
  preloadAdaptorExports,
  Options,
  getExports,
} from '@openfn/compiler';
import { getModulePath, type ExecutionPlan, type Job } from '@openfn/runtime';
import type { SourceMapWithOperations } from '@openfn/lexicon';
import { Workspace } from '@openfn/project';

import createLogger, { COMPILER, Logger } from '../util/logger';
import abort from '../util/abort';
import type { CompileOptions } from './command';

export type CompiledJob = { code: string; map?: SourceMapWithOperations };

export const hasExportableCode = (code: string): boolean =>
  /^\s*(export\s+(const|let|var|function|class)|const|let|var|function|class)\s/m.test(code);

export default async function (
  job: ExecutionPlan,
  opts: CompileOptions,
  log: Logger
): Promise<ExecutionPlan>;

export default async function (
  plan: string,
  opts: CompileOptions,
  log: Logger
): Promise<CompiledJob>;

export default async function (
  planOrPath: string | ExecutionPlan,
  opts: CompileOptions,
  log: Logger
): Promise<CompiledJob | ExecutionPlan> {
  if (typeof planOrPath === 'string') {
    const result = await compileJob(planOrPath as string, opts, log);
    log.success(`Compiled expression from ${opts.expressionPath}`);
    return result;
  }

  const compiledPlan = await compileWorkflow(
    planOrPath as ExecutionPlan,
    opts,
    log
  );
  log.success('Compiled all expressions in workflow');

  return compiledPlan;
}

const compileJob = async (
  job: string,
  opts: CompileOptions,
  log: Logger,
  jobName?: string
): Promise<CompiledJob> => {
  try {
    const compilerOptions: Options = await loadTransformOptions(opts, log);
    if (jobName) {
      compilerOptions.name = jobName;
    }
    return compile(job, compilerOptions);
  } catch (e: any) {
    abort(
      log,
      `Failed to compile job ${jobName ?? ''}`.trim(),
      e,
      'Check the syntax of the job expression:\n\n' + job
    );
    // This will never actually execute
    return { code: job };
  }
};

// Find every expression in the job and run the compiler on it
const compileWorkflow = async (
  plan: ExecutionPlan,
  opts: CompileOptions,
  log: Logger
) => {
  let globalsIgnoreList: string[] = getExports(plan.workflow.globals);

  for (const step of plan.workflow.steps) {
    const job = step as Job;
    const jobOpts = {
      ...opts,
      adaptors: job.adaptors ?? opts.adaptors,
      ignoreImports: globalsIgnoreList,
      trace: opts.trace,
    };
    if (job.expression) {
      const { code, map } = await compileJob(
        job.expression as string,
        jobOpts,
        log,
        job.name ?? job.id
      );
      job.expression = code;
      job.sourceMap = map;
    }
  }
  return plan;
};

// TODO this is a bit of a temporary solution
// Adaptors need a version specifier right now to load type definitions for auto import
// But that specifier must be excluded in the actual import by the adaptor
export const stripVersionSpecifier = (specifier: string) => {
  const idx = specifier.lastIndexOf('@');
  if (idx > 0) {
    return specifier.substring(0, idx);
  }
  return specifier;
};

// Take a module path as provided by the CLI and convert it into a path
export const resolveSpecifierPath = async (
  pattern: string,
  repoDir: string | undefined,
  log: Logger
) => {
  const [specifier, path] = pattern.split('=');

  if (path) {
    // given an explicit path, just load it.
    log.debug(`Resolved ${specifier} to path: ${path}`);
    return path;
  }

  const repoPath = await getModulePath(specifier, repoDir, log);
  if (repoPath) {
    return repoPath;
  }
  return null;
};

// Mutate the opts object to write export information for the add-imports transformer
export const loadTransformOptions = async (
  opts: CompileOptions,
  log: Logger
) => {
  const options: Options = {
    logger: log || createLogger(COMPILER, opts as any),
    trace: opts.trace,
  };

  if (opts.exportsOnly) {
    options['exports-only'] = true;
    // Disable transformers that produce output not needed for unit testing
    options['ensure-exports'] = false;
    options['top-level-operations'] = false;
  }
  // If an adaptor is passed in, we need to look up its declared exports
  // and pass them along to the compiler
  if (opts.adaptors?.length && opts.ignoreImports != true) {
    const adaptorsConfig = [];
    for (const adaptorInput of opts.adaptors) {
      let exports;
      const [specifier] = adaptorInput.split('=');

      // Preload exports from a path, optionally logging errors in case of a failure
      log.debug(`Trying to preload types for ${specifier}`);
      const path = await resolveSpecifierPath(adaptorInput, opts.repoDir, log);
      if (path) {
        try {
          exports = await preloadAdaptorExports(path, log);
        } catch (e) {
          log.error(`Failed to load adaptor typedefs from path ${path}`);
          log.error(e);
        }
      }

      if (!exports || exports.length === 0) {
        log.debug(`No module exports found for ${adaptorInput}`);
      }

      adaptorsConfig.push({
        name: stripVersionSpecifier(specifier),
        exports,
        exportAll: true,
      });
    }

    options['add-imports'] = {
      ignore: opts.ignoreImports as string[],
      adaptors: adaptorsConfig,
    };
  }

  return options;
};

// Compile all steps across all workflows in the current project.
// Writes one .js file per step to compiledDir/<workflow-id>/<step-id>.js.
// Pass workflowFilter to compile a single workflow by id or name.
export const compileProject = async (
  opts: CompileOptions,
  log: Logger,
  cwd = process.cwd(),
  workflowFilter?: string
): Promise<string[]> => {
  // validate=false suppresses warnings when workspace config has no extra metadata
  const workspace = new Workspace(cwd, log as any, false);
  const project = await workspace.getCheckedOutProject();

  if (!project) {
    log.error(
      'No project found. Run from a directory containing openfn.yaml, or provide a path.'
    );
    process.exit(1);
  }

  const wsConfig = workspace.getConfig() as any;

  const compiledDir = opts.outputStdout
    ? null
    : path.resolve(cwd, opts.outputPath ?? wsConfig.dirs?.compiled ?? 'compiled');

  if (compiledDir) {
    log.info(`Compiling project to ${compiledDir}`);
  }

  let workflows = project.workflows;
  if (workflowFilter) {
    workflows = workflows.filter(
      (wf: any) => wf.id === workflowFilter || wf.name === workflowFilter
    );
    if (workflows.length === 0) {
      log.error(`Workflow '${workflowFilter}' not found in project.`);
      process.exit(1);
    }
  }

  const outPaths: string[] = [];
  const stalePaths: string[] = [];

  for (const workflow of workflows) {
    for (const step of workflow.steps) {
      const expression = (step as any).expression;
      if (!expression || typeof expression !== 'string') continue;

      const adaptor: string | undefined =
        (step as any).adaptor ?? (step as any).adaptors?.[0];
      const stepOpts: CompileOptions = {
        ...opts,
        adaptors: adaptor ? [adaptor] : opts.adaptors ?? [],
      };

      const { code } = await compileJob(
        expression,
        stepOpts,
        log,
        (step as any).name ?? step.id
      );

      if (opts.exportsOnly && !hasExportableCode(code)) {
        const stalePath = compiledDir
          ? path.join(compiledDir, workflow.id, `${step.id}.js`)
          : null;
        log.info(`  ${workflow.id}/${step.id} — skipped (no exportable code after stripping)`);
        if (stalePath) stalePaths.push(stalePath);
        continue;
      }

      if (opts.outputStdout) {
        log.success(`// ${workflow.id}/${step.id}\n\n` + code);
      } else {
        const outPath = path.join(compiledDir!, workflow.id, `${step.id}.js`);
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, code);
        outPaths.push(outPath);
        log.success(`  ${workflow.id}/${step.id} → ${outPath}`);
      }
    }
  }

  // Remove stale step files left over from a previous run with different flags.
  // Only deletes files at exact step paths — user-added files with other names are untouched.
  for (const stalePath of stalePaths) {
    try {
      await fs.unlink(stalePath);
      log.info(`  Removed stale ${stalePath}`);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  if (!opts.outputStdout) {
    log.success(`Compiled ${outPaths.length} step(s) to ${compiledDir}`);
  }
  return outPaths;
};
