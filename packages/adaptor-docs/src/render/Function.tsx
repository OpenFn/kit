import React from 'react';
import type { FunctionDescription } from '@openfn/describe-package';

type RenderFunctionProps = {
  fn: FunctionDescription
  onInsert?: (text: string) => void;
}

const doCopy = async (text: string) => {
  const type = "text/plain";
  const data = [new ClipboardItem({ [type]: new Blob([text], { type } )})];

  try {
    await navigator.clipboard.write(data);
  } catch(e) {
    alert('COPY FAILED')
  }
}

const getSignature = (fn: FunctionDescription) => {
  const paramList: string[] = fn.parameters.map(({ name }) => name);

  return `${fn.name}(${paramList.join(', ')})`
}

const PreButton = ({ label, onClick }: { label: string, onClick?: () => void }) => 
  // TODO give some kind of feedback on click
  <button
    className="rounded-md bg-slate-300 text-white px-2 py-1 mr-1 text-xs"
    onClick={onClick}>
    {label}
  </button>

const RenderFunction = ({ fn, onInsert }: RenderFunctionProps) => {
  return (
    <div className="block mb-10">
      <label className="block text-m font-bold text-secondary-700 mb-1">{getSignature(fn)}</label>
      <p className="block text-sm">{fn.description}</p>
      {fn.examples.map((eg, idx) =>
        <div key={`${fn.name}-eg-${idx}`}>
          <div className="w-full px-5 text-right" style={{ height: '13px'}}>
            <PreButton label="COPY" onClick={() => doCopy(eg)} />
            {onInsert && <PreButton label="INSERT" onClick={() => onInsert(eg)} />}
          </div>
          <pre
            className="rounded-md pl-4 pr-30 py-2 mx-4 my-0 font-mono bg-slate-100 border-2 border-slate-200 text-slate-800 min-h-full text-xs overflow-x-auto"
            >
              {eg}
          </pre>
        </div>
      )}
    </div>
  )
}

export default RenderFunction;