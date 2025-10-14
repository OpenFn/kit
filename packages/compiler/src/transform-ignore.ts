import { namedTypes as n } from 'ast-types';
import { NodePath } from 'ast-types/lib/node-path';

const IgnoreRules = (path: NodePath<n.Expression>) => {
  return {
    check: n.ObjectExpression.check(path.node),
    shouldSkip: () => {
      if (
        n.VariableDeclarator.check(path.parentPath.node) &&
        n.VariableDeclaration.check(path.parentPath.parentPath.node) &&
        n.Program.check(path.parentPath.parentPath.parentPath.parentPath.node)
      ) {
        return true;
      }
      return false;
    },
  };
};

export default IgnoreRules;
