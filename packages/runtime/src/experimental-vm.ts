/**
 * Wrapper around node:vm with basic type support for experimental stuff
 */
import * as vm from 'node:vm';

// Simple vm.Module type definition (just enough to keep ts happy)
export interface Module {
  link(handler: (specifier: string) => Promise<Module>): Promise<void>;
  evaluate(): Promise<void>;
  namespace: Record<string, any>;
}

export interface SyntheticModule extends Module {
  new (exports: string[], fn: () => void, context: vm.Context): SyntheticModule;
  setExport(name: string, value: any): void;
} 

export interface SourceTextModule extends Module {
  new (source: string, options: any): SyntheticModule;
  setExport(name: string, value: any): void;
} 


export type ExperimentalVM = typeof vm & {
  SyntheticModule: SyntheticModule;
  SourceTextModule: SourceTextModule;
}

export default vm as ExperimentalVM;
export type { Context } from 'node:vm';
