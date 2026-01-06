import vm, { Context } from './experimental-vm';

export default (expression: string, context: Context, args: string[] = []) => {
  return vm.compileFunction(`return ${expression}`, ['state'].concat(args), {
    parsingContext: context,
  });
};
