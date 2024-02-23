import { mainSymbols } from 'figures';

const { triangleRightSmall: t } = mainSymbols;

export type Versions = {
  node: string;
  worker: string;

  [adaptor: string]: string | string[];
};

export default (versions: Versions) => {
  let longest = 'worker'.length; // Bit wierdly defensive but ensure padding is reasonable even if version has no props
  for (const v in versions) {
    longest = Math.max(v.length, longest);
  }

  const { node, worker, compiler, runtime, engine, ...adaptors } = versions;
  // Prefix and pad version numbers
  const prefix = (str: string) => `    ${t} ${str.padEnd(longest + 4, ' ')}`;

  let str = `Versions:
${prefix('node.js')}${versions.node || 'unknown'}
${prefix('worker')}${versions.worker || 'unknown'}`;

  if (Object.keys(adaptors).length) {
    let allAdaptors = Object.keys(adaptors);
    str +=
      '\n' +
      allAdaptors
        .sort()
        .map(
          (adaptorName) =>
            `${prefix(adaptorName)}${(adaptors[adaptorName] as string[])
              .sort()
              .join(', ')}`
        )
        .join('\n');
  }

  return str;
};
