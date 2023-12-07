import { mainSymbols } from 'figures';

const { triangleRightSmall: t } = mainSymbols;

export type Versions = {
  node: string;
  worker: string;
  engine: string;

  [adaptor: string]: string;
};

export default (runId: string, versions: Versions) => {
  let longest = 'compiler'.length; // Bit wierdly defensive but ensure padding is reasonable even if version has no props
  for (const v in versions) {
    longest = Math.max(v.length, longest);
  }

  const { node, compiler, engine, worker, ...adaptors } = versions;
  // Prefix and pad version numbers
  const prefix = (str: string) => `    ${t} ${str.padEnd(longest + 4, ' ')}`;

  let str = `${runId} versions:
  ${prefix('node.js')}${versions.node || 'unknown'}
  ${prefix('worker')}${versions.worker || 'unknown'}
  ${prefix('engine')}${versions.engine || 'unknown'}
  ${prefix('compiler')}${versions.compiler || 'unknown'}`;

  if (Object.keys(adaptors).length) {
    str +=
      '\n' +
      Object.keys(adaptors)
        .sort()
        .map((adaptorName) => `${prefix(adaptorName)}${adaptors[adaptorName]}`)
        .join('\n');
  }

  return str;
};
