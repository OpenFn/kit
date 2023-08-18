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

type IncomingOpts = {
  command?: string;
  log?: string;
};

const ensureLogOpts = (opts: IncomingOpts) => {
  const components: Record<string, LogLevel> = {};

  // Note that incoming opts from yargs will be a string array
  const outgoingOpts = opts as Opts; // happy to mutate the incoming object here

  // TODO find a neater way to handle defaults
  if (!opts.log && /^(version|test)$/.test(opts.command!)) {
    // version and test log to info by default
    outgoingOpts.log = { default: 'info' };
    return outgoingOpts;
  }

  if (opts.log) {
    // Parse and validate each incoming log argument
    const parts = opts.log.split(',');
    parts.forEach((l: string) => {
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

      if (!/^(cli|runtime|compiler|job|default)$/i.test(component)) {
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

  outgoingOpts.log = {
    ...defaultLoggerOptions,
    ...components,
  };

  return outgoingOpts;
};

export default ensureLogOpts;
