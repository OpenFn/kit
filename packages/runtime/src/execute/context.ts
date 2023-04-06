import { Logger } from '@openfn/logger';
import vm from 'node:vm';
import type { Options, State } from '../types';

// Build a safe and helpful execution context
// This will be shared by all operations
// TODO is it possible for one operation to break the npm cache somehow?
export default (state: State, options: Pick<Options, 'jobLogger'>) => {
  const logger = options.jobLogger ?? console;
  const context = vm.createContext(
    {
      console: logger,
      state, // TODO I don't really want to pass global state through
      clearInterval,
      clearTimeout,
      parseFloat,
      parseInt,
      setInterval,
      setTimeout,
    },
    {
      codeGeneration: {
        strings: false,
        wasm: false,
      },
    }
  );

  return context;
};

// Special, highly restricted cotext for a plan condition
// Ie, a javascript expression
export const conditionContext = () => {
  const context = vm.createContext(
    {
      console,
    },
    {
      codeGeneration: {
        strings: false,
        wasm: false,
      },
    }
  );

  return context;
};

export type Context = vm.Context;
