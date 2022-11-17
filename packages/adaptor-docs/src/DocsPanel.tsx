import React from 'react';
import type { PackageDescription, FunctionDescription } from '@openfn/describe-package';
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
    <div className="ad--block ad--m-2">
      <h1 className="ad--h1 ad--text-lg ad--font-bold ad--text-secondary-700 ad--mb-2">{name} v{version}</h1>
      <div className="ad--text-sm ad--mb-4">Operations available for use by this adaptor are listed below.</div>
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