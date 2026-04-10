import Workflow from '../Workflow';

export type StepChangeType = 'added' | 'removed' | 'changed';

export type StepChange = {
  id: string;
  name: string;
  type: StepChangeType;
  changes?: {
    name?: { from: string; to: string };
    adaptor?: { from: string; to: string };
    body?: string;
  };
};

const TRACKED_FIELDS: Array<{ key: 'name' | 'adaptor' }> = [
  { key: 'name' },
  { key: 'adaptor' },
];

export const generateStepDiff = (
  localWf: Workflow | undefined,
  remoteWf: Workflow | undefined
): StepChange[] => {
  if (!localWf || !remoteWf) return [];

  const localSteps = localWf.steps as any[];
  const remoteSteps = remoteWf.steps as any[];
  const remoteById = Object.fromEntries(remoteSteps.map((s) => [s.id, s]));
  const localById = Object.fromEntries(localSteps.map((s) => [s.id, s]));

  const changes: StepChange[] = [];

  for (const step of localSteps) {
    const remote = remoteById[step.id];
    if (!remote) {
      changes.push({ id: step.id, name: step.name || step.id, type: 'added' });
      continue;
    }

    const fieldChanges: StepChange['changes'] = {};

    for (const { key } of TRACKED_FIELDS) {
      const localVal = step[key];
      const remoteVal = remote[key];
      if (localVal !== remoteVal) {
        fieldChanges[key] = { from: remoteVal, to: localVal };
      }
    }

    const localExpr = step.expression ?? step.body ?? '';
    const remoteExpr = remote.expression ?? remote.body ?? '';
    if (localExpr !== remoteExpr) {
      const lineDiff =
        localExpr.split('\n').length - remoteExpr.split('\n').length;
      fieldChanges.body =
        lineDiff > 0
          ? `+${lineDiff} lines`
          : lineDiff < 0
          ? `${lineDiff} lines`
          : '<changed>';
    }

    if (Object.keys(fieldChanges).length > 0) {
      changes.push({
        id: step.id,
        name: step.name || step.id,
        type: 'changed',
        changes: fieldChanges,
      });
    }
  }

  for (const step of remoteSteps) {
    if (!localById[step.id]) {
      changes.push({
        id: step.id,
        name: step.name || step.id,
        type: 'removed',
      });
    }
  }

  return changes;
};
