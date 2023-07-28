/**
 * Wrapper around node:vm with basic type support for experimental stuff
 */
import * as vm from 'node:vm';

export interface SyntheticModule extends vm.Module {
  new (exports: string[], fn: () => void, context: vm.Context): SyntheticModule;
  setExport(name: string, value: any): void;
}

export interface SourceTextModule extends vm.Module {
  new (source: string, options: any): SyntheticModule;
  setExport(name: string, value: any): void;
}

export type ExperimentalVM = typeof vm & {
  SyntheticModule: SyntheticModule;
  SourceTextModule: SourceTextModule;
};

export default vm as ExperimentalVM;
export type { Context, Module } from 'node:vm';
