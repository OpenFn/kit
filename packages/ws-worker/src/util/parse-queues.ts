export interface SlotGroup {
  queues: string[];
  maxSlots: number;
}

export class QueuesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueuesValidationError';
  }
}

const VALID_NAME = /^[a-zA-Z0-9_]+$/;

export default function parseQueues(input: string): SlotGroup[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new QueuesValidationError('Queues configuration cannot be empty');
  }

  const tokens = trimmed.split(/\s+/);
  const groups = tokens.map(parseToken);

  // Warn if multiple slot groups have identical queue configurations
  const seenConfigs = new Map<string, number>();
  for (let i = 0; i < groups.length; i++) {
    const key = JSON.stringify(groups[i].queues);
    if (seenConfigs.has(key)) {
      const prevIndex = seenConfigs.get(key)!;
      console.warn(
        `Warning: slot groups at positions ${prevIndex} and ${i} have identical queue configurations: ${tokens[prevIndex]} and ${tokens[i]}`
      );
    } else {
      seenConfigs.set(key, i);
    }
  }

  return groups;
}

function parseToken(token: string): SlotGroup {
  const lastColon = token.lastIndexOf(':');
  if (lastColon === -1) {
    throw new QueuesValidationError(
      `Invalid token "${token}": missing :<count> suffix`
    );
  }

  const prefStr = token.slice(0, lastColon);
  const countStr = token.slice(lastColon + 1);

  const count = Number(countStr);
  if (!Number.isInteger(count) || countStr !== String(Math.floor(count))) {
    throw new QueuesValidationError(
      `Invalid count "${countStr}" in token "${token}": must be a positive integer`
    );
  }
  if (count < 1) {
    throw new QueuesValidationError(
      `Invalid count "${countStr}" in token "${token}": must be >= 1`
    );
  }

  const names = prefStr.split(',');
  for (const name of names) {
    if (name === '') {
      throw new QueuesValidationError(
        `Empty queue name in token "${token}"`
      );
    }
    if (name !== '*' && !VALID_NAME.test(name)) {
      throw new QueuesValidationError(
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
    throw new QueuesValidationError(
      `Wildcard "*" must be the last element in token "${token}"`
    );
  }

  return { queues: names, maxSlots: count };
}
