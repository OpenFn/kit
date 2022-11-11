// TODO not a great dependency
// I think the repo will end up moving out of the runtime
import React from 'react';
import { getNameAndVersion }  from './util';
import useDocs from './useDocs';

type DocsPanelProps = {
  specifier?: string;
}

// TODO copied from describe-package
type FunctionDescription = {
  name: string;
  comment: string;
};

// TODO this will move out
// Not quite sure what it is yet
// TODO:
// - it has to be collapsible
// - it needs a lot more metadata (args, example)
const DocsListing = ({ item }: { item: FunctionDescription }) => {
  return (
    <div>
      <h2>{item.name}</h2>
      <p>{item.comment}</p>
    </div>
  )
}

const DocsPanel = ({ specifier }: DocsPanelProps) => {
  if (!specifier) {;
    return <div>nothing selected</div>;
  }

  const { name, version } = getNameAndVersion(specifier);

  const data = useDocs();
  return (
  <div>
    <h1>{name}</h1>
    {data.map((item) => <DocsListing key={item.name} item={item} />)}
  </div>)
};

export default DocsPanel;