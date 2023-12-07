import { mainSymbols } from 'figures';

const { triangleRightSmall: t } = mainSymbols;

export type Versions = {
  node: string;
  worker: string;
  engine: string;

  [adaptor: string]: string;
};

export default (runId: string, versions: Versions, adaptor?: string) => {
  let longest = 'compiler'.length; // Bit wierdly defensive but ensure padding is reasonable even if version has no props
  for (const v in versions) {
    longest = Math.max(v.length, longest);
  }

  const { node, compiler, engine, worker, runtime, ...adaptors } = versions;
  // Prefix and pad version numbers
  const prefix = (str: string) => `    ${t} ${str.padEnd(longest + 4, ' ')}`;

  let str = `Versions for run ${runId}:
${prefix('node.js')}${versions.node || 'unknown'}
${prefix('worker')}${versions.worker || 'unknown'}
${prefix('engine')}${versions.engine || 'unknown'}`;

  // Unfortunately the runtime and compiler versions get reported as workspace:* in prod right now
  // ${prefix('runtime')}${versions.runtime || 'unknown'}
  // ${prefix('compiler')}${versions.compiler || 'unknown'}`;

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
