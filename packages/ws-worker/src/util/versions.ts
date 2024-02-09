import { mainSymbols } from 'figures';

const { triangleRightSmall: t } = mainSymbols;

export type Versions = {
  node: string;
  worker: string;

  [adaptor: string]: string;
};

export default (stepId: string, versions: Versions, adaptor?: string) => {
  let longest = 'worker'.length; // Bit wierdly defensive but ensure padding is reasonable even if version has no props
  for (const v in versions) {
    longest = Math.max(v.length, longest);
  }

  const { node, worker, ...adaptors } = versions;
  // Prefix and pad version numbers
  const prefix = (str: string) => `    ${t} ${str.padEnd(longest + 4, ' ')}`;

  let str = `Versions for step ${stepId}:
${prefix('node.js')}${versions.node || 'unknown'}
${prefix('worker')}${versions.worker || 'unknown'}`;

  if (Object.keys(adaptors).length) {
    let allAdaptors = Object.keys(adaptors);
    if (adaptor) {
      allAdaptors = allAdaptors.filter((name) => adaptor.startsWith(name));
    }
    str +=
      '\n' +
      allAdaptors
        .sort()
        .map((adaptorName) => `${prefix(adaptorName)}${adaptors[adaptorName]}`)
        .join('\n');
  }

  return str;
};
