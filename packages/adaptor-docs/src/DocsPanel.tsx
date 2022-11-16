import React from 'react';
import type { FunctionDescription } from '@openfn/describe-package';
// TODO not a great dependency
// I think the repo will end up moving out of the runtime
import { getNameAndVersion }  from './util';
import useDocs from './useDocs';

type DocsPanelProps = {
  specifier?: string;
  onInsert?: (text: string) => void;
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

const PreButton = ({ label, onClick }: { label: string, onClick?: () => void }) => 
  // TODO give some kind of feedback on click
  <button
    className="rounded-md bg-slate-300 text-white px-2 py-1 mr-1 text-xs"
    onClick={onClick}>
    {label}
  </button>

const DocsFn = ({ item, onInsert }: { item: FunctionDescription, onInsert?: DocsPanelProps['onInsert'] }) => {
  const doCopy = async (text: string) => {
    const type = "text/plain";
    const data = [new ClipboardItem({ [type]: new Blob([text], { type } )})];
  
    try {
      await navigator.clipboard.write(data);
    } catch(e) {
      alert('COPY FAILED')
    }
  }

  return (
    <div className="block mb-10">
      <label className="block text-m font-bold text-secondary-700 mb-1">{getSignature(item)}</label>
      <p className="block text-sm">{item.description}</p>
      {item.examples.map((eg, idx) =>
        <>
          <div className="w-full px-5 text-right" style={{ height: '13px'}}>
            <PreButton label="COPY" onClick={() => doCopy(eg)} />
            {onInsert && <PreButton label="INSERT" onClick={() => onInsert(eg)} />}
          </div>
          <pre
            className="rounded-md pl-4 pr-30 py-2 mx-4 my-0 font-mono bg-slate-100 border-2 border-slate-200 text-slate-800 min-h-full text-xs overflow-x-auto"
            key={`${item.name}-eg-${idx}`}>
              {eg}
          </pre>
        </>
      )}
    </div>
  )
}


const DocsPanel = ({ specifier, onInsert }: DocsPanelProps) => {
  if (!specifier) {;
    return <div>nothing selected</div>;
  }
  const { name, version } = getNameAndVersion(specifier);

  const docs = useDocs(specifier);
  return (
    <div className="block m-2 mb-8">
      <h1 className="h1 text-xl mb-6 font-bold text-secondary-700">{name} v{version}</h1>
      {docs.map((item) => <DocsFn key={item.name} item={item} onInsert={onInsert} />)}
    </div>
    );
};

export default DocsPanel;