import path from 'node:path';
import { SafeOpts } from '../commands';
import { DEFAULT_REPO_DIR } from '../constants';
import { Opts } from '../options';
import { LogLevel, isValidLogLevel } from './logger';

export const defaultLoggerOptions = {
  default: 'default' as const,
  //  TODO fix to lower case
  job: 'debug' as const,
};

export const ERROR_MESSAGE_LOG_LEVEL =
  'Unknown log level. Valid levels are none, debug, info and default.';
export const ERROR_MESSAGE_LOG_COMPONENT =
  'Unknown log component. Valid components are cli, compiler, runtime and job.';

const componentShorthands: Record<string, string> = {
  cmp: 'compiler',
  rt: 'runtime',
  'r/t': 'runtime',
};

// TODO what about shorthands?
const isValidComponent = (v: string) =>
  /^(cli|runtime|compiler|job|default)$/i.test(v);

// TODO the log typing is pretty messy (this is a wider issue)
export const ensureLogOpts = (opts: Opts) => {
  const components: Record<string, LogLevel> = {};
  if (!opts.log && /^(version|test)$/.test(opts.command!)) {
    // version and test log to info by default
    (opts as any).log = { default: 'info' };
    return opts;
  } else if (opts.log) {
    // Parse and validate each incoming log argument
    opts.log.forEach((l: string) => {
      let component = '';
      let level = '';

      if (l.match(/=/)) {
        const parts = l.split('=');
        component = parts[0].toLowerCase();
        if (componentShorthands[component]) {
          component = componentShorthands[component];
        }
        level = parts[1].toLowerCase() as LogLevel;
      } else {
        component = 'default';
        level = l.toLowerCase() as LogLevel;
      }

      if (!isValidComponent(component)) {
        throw new Error(ERROR_MESSAGE_LOG_COMPONENT);
      }

      level = level.toLowerCase();
      if (!isValidLogLevel(level)) {
        // TODO need to think about how the CLI frontend handles these errors
        // But this is fine for now
        throw new Error(ERROR_MESSAGE_LOG_LEVEL);
      }

      components[component] = level as LogLevel;
    });
  }

  (opts as any).log = {
    ...defaultLoggerOptions,
    ...components,
  };

  // TODO messy typings because of log stuff
  return opts as unknown as SafeOpts;
};

// TODO this function is now deprecated and slowly being phased out
export default function ensureOpts(
  basePath: string = '.',
  opts: Opts
): SafeOpts {
  const newOpts = {
    adaptor: opts.adaptor, // only applies to install (a bit messy) (now applies to docs too)
    adaptors: opts.adaptors || [],
    autoinstall: opts.autoinstall,
    command: opts.command,
    expandAdaptors: opts.expandAdaptors !== false,
    force: opts.force || false,
    immutable: opts.immutable || false,
    log: opts.log as unknown, // TMP this will be overwritten later
    logJson:
      typeof opts.logJson == 'boolean'
        ? opts.logJson
        : Boolean(process.env.OPENFN_LOG_JSON),
    compile: Boolean(opts.compile),
    operation: opts.operation,
    outputStdout: Boolean(opts.outputStdout),
    packages: opts.packages,
    repoDir: opts.repoDir || process.env.OPENFN_REPO_DIR || DEFAULT_REPO_DIR,
    skipAdaptorValidation: opts.skipAdaptorValidation ?? false,
    specifier: opts.specifier,
    stateStdin: opts.stateStdin,
    timeout: opts.timeout,
  } as SafeOpts;
  const set = (key: keyof Opts, value: string) => {
    // @ts-ignore TODO
    newOpts[key] = opts.hasOwnProperty(key) ? opts[key] : value;
  };

  if (opts.useAdaptorsMonorepo) {
    newOpts.monorepoPath = process.env.OPENFN_ADAPTORS_REPO || 'ERR';
  }

  let baseDir = basePath;
  if (basePath.endsWith('.js')) {
    baseDir = path.dirname(basePath);
    set('jobPath', basePath);
  } else {
    set('jobPath', `${baseDir}/job.js`);
  }
  set('statePath', `${baseDir}/state.json`);

  if (!opts.outputStdout) {
    set(
      'outputPath',
      newOpts.command === 'compile'
        ? `${baseDir}/output.js`
        : `${baseDir}/output.json`
    );
  }

  // TODO another messy typing caused by the log stuff
  ensureLogOpts(newOpts as any);

  return newOpts;
}
