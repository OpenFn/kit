import path from 'node:path';
import fs from 'node:fs/promises';
import { rimraf } from 'rimraf';
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

export const resolveSpecifierPath = async (
  pattern: string,
  repoDir: string | undefined,
  log: Logger
) => {
  const [specifier, path] = pattern.split('=');

  if (path) {
    log.debug(`Resolved ${specifier} to path: ${path}`);
    return path;
  }

  const repoPath = await getModulePath(specifier, repoDir, log);
  if (repoPath) {
    return repoPath;
  }
  return null;
};

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
    // ensure-exports and top-level-operations produce output incompatible with exports-only mode
    options['ensure-exports'] = false;
    options['top-level-operations'] = false;
  }
  if (opts.adaptors?.length && opts.ignoreImports != true) {
    const adaptorsConfig = [];
    for (const adaptorInput of opts.adaptors) {
      let exports;
      const [specifier] = adaptorInput.split('=');

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

export const compileProject = async (
  opts: CompileOptions,
  log: Logger,
  workspacePath: string,
  workflowFilter?: string
): Promise<string[]> => {
  // validate=false suppresses warnings when workspace config has no extra metadata
  const workspace = new Workspace(workspacePath, log as any, false);
  const project = await workspace.getCheckedOutProject();

  if (!project) {
    log.error(
      'No project found. Run from a directory containing openfn.yaml, or provide a path.'
    );
    process.exit(1);
  }

  const wsConfig = workspace.getConfig();

  const compiledDir = opts.outputStdout
    ? null
    : path.resolve(
        workspacePath,
        opts.outputPath ?? wsConfig.dirs?.compiled ?? 'dist'
      );

  if (compiledDir) {
    if (opts.clean) {
      log.info(`Cleaning ${compiledDir}`);
      await rimraf(compiledDir);
    }
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

  const allSteps = workflows.flatMap((wf: any) =>
    wf.steps
      .filter((step: any) => step.expression)
      .map((step: any) => ({ workflow: wf, step }))
  );

  for (const { workflow, step } of allSteps) {
    const stepOpts: CompileOptions = {
      ...opts,
      adaptors: step.adaptor ? [step.adaptor] : opts.adaptors ?? [],
    };

    const { code } = await compileJob(
      step.expression,
      stepOpts,
      log,
      step.name ?? step.id
    );

    const stepId = `${workflow.id}/${step.id}`;

    if (opts.exportsOnly && !code.trim()) {
      log.debug(`  ${stepId} — skipped (empty after stripping)`);
      continue;
    }

    if (opts.outputStdout) {
      log.success(`// ${stepId}\n\n` + code);
    } else {
      const outPath = path.join(compiledDir!, workflow.id, `${step.id}.mjs`);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, code);
      outPaths.push(outPath);
      log.info(`Compiled ${stepId} to ${outPath}`);
    }
  }

  if (!opts.outputStdout) {
    log.success(`Compiled ${outPaths.length} step(s) to ${compiledDir}`);
  }
  return outPaths;
};
