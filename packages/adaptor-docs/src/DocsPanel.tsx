import React from 'react';
import type { PackageDescription } from '@openfn/describe-package';
import useDocs from './useDocs';
import Function from './render/Function';

type DocsPanelProps = {
  specifier?: string;
  onInsert?: (text: string) => void;
}

const DocsPanel = ({ specifier, onInsert }: DocsPanelProps) => {
  if (!specifier) {;
    return <div>Nothing selected</div>;
  }

  const pkg = useDocs(specifier);
  if (pkg === null) {
    return <div>Loading...</div>
  }
  if (pkg === false) {
    return <div>Failed to load docs.</div>
  }
  
  const { name, version, functions } = pkg as PackageDescription;
  return (
    <div className="block m-2 mb-8">
      <h1 className="h1 text-xl mb-6 font-bold text-secondary-700">{name} v{version}</h1>
      {functions
        // TODO we ought to memo the sort really, although this won't render very often so it's probably ok
        .sort((a, b) => {
          if (a.name > b.name) return 1;
          else if (a.name < b.name) return -1;
          return 0;
        })
        .map((fn) => <Function key={fn.name} fn={fn} onInsert={onInsert} />)}
    </div>
    );
};

export default DocsPanel;