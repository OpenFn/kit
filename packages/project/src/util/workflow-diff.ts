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

    [other: string]: any;
  };
};

export type EdgeChange = {
  id: string;
  type: StepChangeType;
  changes?: {
    condition?: { from?: string; to?: string };
    label?: { from?: string; to?: string };
    enabled?: { from: boolean; to: boolean };

    [other: string]: any;
  };
};

const trackedStepFields: string[] = ['name', 'adaptor', 'configuration'];
const trackedEdgeFields: string[] = ['condition', 'label', 'disabled'];

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

    for (const key of trackedStepFields) {
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
        lineDiff >= 0 ? `+${lineDiff + 1} lines` : `${lineDiff} lines`;
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

const getEdgeMap = (wf: Workflow): Record<string, any> => {
  const map: Record<string, any> = {};
  for (const step of wf.steps as any[]) {
    const next =
      typeof step.next === 'string' ? { [step.next]: {} } : step.next ?? {};
    for (const [targetId, rules] of Object.entries(next)) {
      map[`${step.id}->${targetId}`] =
        typeof rules === 'object' && rules !== null ? rules : {};
    }
  }
  return map;
};

export const generateEdgeDiff = (
  localWf: Workflow | undefined,
  remoteWf: Workflow | undefined
): EdgeChange[] => {
  if (!localWf || !remoteWf) return [];

  const localEdges = getEdgeMap(localWf);
  const remoteEdges = getEdgeMap(remoteWf);
  const changes: EdgeChange[] = [];

  for (const [id, local] of Object.entries(localEdges)) {
    const remote = remoteEdges[id];
    if (!remote) {
      changes.push({ id, type: 'added' });
      continue;
    }

    const fieldChanges: EdgeChange['changes'] = {};

    for (const key of trackedEdgeFields) {
      if (local[key] != remote[key]) {
        fieldChanges[key] = { from: remote[key], to: local[key] };
      }
    }

    if (Object.keys(fieldChanges).length > 0) {
      changes.push({ id, type: 'changed', changes: fieldChanges });
    }
  }

  for (const id of Object.keys(remoteEdges)) {
    if (!localEdges[id]) {
      changes.push({ id, type: 'removed' });
    }
  }

  return changes;
};
