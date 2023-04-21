import vm, { Context } from './experimental-vm';

export default (expression: string, context: Context) => {
  return vm.compileFunction(`return ${expression}`, ['state'], {
    parsingContext: context,
  });
};
