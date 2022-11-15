// TODO not a great dependency
// I think the repo will end up moving out of the runtime
import React from 'react';
import { getNameAndVersion }  from './util';
import useDocs from './useDocs';
import type { FunctionDescription } from '@openfn/describe-package';

type DocsPanelProps = {
  specifier?: string;
}

const getSignature = (fn: FunctionDescription) => {
  const paramList: string[] = fn.parameters.map(({ name }) => name);

  return `${fn.name}(${paramList.join(', ')})`
}

// TODO this will move out
// Not quite sure what it is yet
// TODO:
// - it has to be collapsible
// - it needs a lot more metadata (args, example)
const DocsListing = ({ item }: { item: FunctionDescription }) => {
  return (
    <div>
      <h2>{getSignature(item)}</h2>
      <p>{item.description}</p>
      {item.examples.map((eg) => <pre>{eg}</pre>)}
    </div>
  )
}


const DocsPanel = ({ specifier }: DocsPanelProps) => {
  if (!specifier) {;
    return <div>nothing selected</div>;
  }

  const { name, version } = getNameAndVersion(specifier);

  const data = useDocs(specifier);
  return (
  <div>
    <h1>Adaptor {name} v{version}</h1>
    {data.map((item) => <DocsListing key={item.name} item={item} />)}
  </div>)
};

export default DocsPanel;