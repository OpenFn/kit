export interface WorkloopConfig {
  queues: string[];
  capacity: number;
}

export interface Workloop extends WorkloopConfig {
  id: string;
  activeRuns: Set<string>;
  openClaims: Record<string, number>;
  stop: (reason?: string) => void;
  isStopped: () => boolean;
}

export function workloopHasCapacity(workloop: Workloop): boolean {
  const pendingClaims = Object.values(workloop.openClaims).reduce(
    (a, b) => a + b,
    0
  );
  return workloop.activeRuns.size + pendingClaims < workloop.capacity;
}

export function createWorkloop(config: WorkloopConfig): Workloop {
  return {
    ...config,
    id: `${config.queues.join('>')}:${config.capacity}`,
    activeRuns: new Set(),
    openClaims: {},
    stop: () => {},
    isStopped: () => true,
  };
}

export class WorkloopValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkloopValidationError';
  }
}

const VALID_NAME = /^[a-zA-Z0-9_]+$/;

export default function parseWorkloops(input: string): WorkloopConfig[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new WorkloopValidationError('Workloop configuration cannot be empty');
  }

  const tokens = trimmed.split(/\s+/);
  const configs = tokens.map(parseToken);

  // Warn if multiple workloops have identical queue configurations
  const seenConfigs = new Map<string, number>();
  for (let i = 0; i < configs.length; i++) {
    const key = JSON.stringify(configs[i].queues);
    if (seenConfigs.has(key)) {
      const prevIndex = seenConfigs.get(key)!;
      console.warn(
        `Warning: workloops at positions ${prevIndex} and ${i} have identical queue configurations: ${tokens[prevIndex]} and ${tokens[i]}`
      );
    } else {
      seenConfigs.set(key, i);
    }
  }

  return configs;
}

function parseToken(token: string): WorkloopConfig {
  const lastColon = token.lastIndexOf(':');
  if (lastColon === -1) {
    throw new WorkloopValidationError(
      `Invalid token "${token}": missing :<count> suffix`
    );
  }

  const prefStr = token.slice(0, lastColon);
  const countStr = token.slice(lastColon + 1);

  const count = Number(countStr);
  if (!Number.isInteger(count) || countStr !== String(Math.floor(count))) {
    throw new WorkloopValidationError(
      `Invalid count "${countStr}" in token "${token}": must be a positive integer`
    );
  }
  if (count < 1) {
    throw new WorkloopValidationError(
      `Invalid count "${countStr}" in token "${token}": must be >= 1`
    );
  }

  const names = prefStr.split('>');
  for (const name of names) {
    if (name === '') {
      throw new WorkloopValidationError(`Empty queue name in token "${token}"`);
    }
    if (name !== '*' && !VALID_NAME.test(name)) {
      throw new WorkloopValidationError(
        `Invalid queue name "${name}" in token "${token}": must match /^[a-zA-Z0-9_]+$/ or be "*"`
      );
    }
  }

  // Warn about duplicate queue names (excluding wildcards)
  const nonWildcardNames = names.filter((n) => n !== '*');
  const seen = new Set<string>();
  for (const name of nonWildcardNames) {
    if (seen.has(name)) {
      console.warn(
        `Warning: duplicate queue name "${name}" in token "${token}"`
      );
    }
    seen.add(name);
  }

  const wildcardIndex = names.indexOf('*');
  if (wildcardIndex !== -1 && wildcardIndex !== names.length - 1) {
    throw new WorkloopValidationError(
      `Wildcard "*" must be the last element in token "${token}"`
    );
  }

  return { queues: names, capacity: count };
}
