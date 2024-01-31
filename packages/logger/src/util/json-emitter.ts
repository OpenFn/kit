import stringify from 'fast-safe-stringify';
import { LogEmitter } from '../options';

const jsonEmitter: Partial<LogEmitter> = {
  ...console,
};

['log', 'info', 'success', 'always', 'debug', 'warn', 'error'].forEach((fn) => {
  // @ts-ignore
  jsonEmitter[fn] = (...args: any[]) => {
    const stringified = args.map((value) => stringify(value));
    // @ts-ignore
    console[fn](...stringified);
  };
});

export default jsonEmitter as LogEmitter;
