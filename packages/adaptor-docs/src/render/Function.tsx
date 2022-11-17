import React from 'react';
import type { FunctionDescription } from '@openfn/describe-package';

type RenderFunctionProps = {
  fn: FunctionDescription;
  onInsert?: (text: string) => void;
}

type PreButtonFunctionProps = {
  tooltip?: string;
  label: string;
  onClick?: () => void;
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

const PreButton = ({ label, onClick, tooltip }: PreButtonFunctionProps) => 
  // TODO give some kind of feedback on click
  <button
    className="ad--rounded-md ad--bg-slate-300 ad--text-white ad--px-2 ad--py-1 ad--mr-1 ad--text-xs"
    title={tooltip || ''}
    onClick={onClick}>
    {label}
  </button>

const RenderFunction = ({ fn, onInsert }: RenderFunctionProps) => {
  return (
    <div className="ad--block ad--mb-10">
      <label className="ad--block ad--text-m ad--font-bold ad--text-secondary-700 ad--mb-1">{getSignature(fn)}</label>
      <p className="ad--block ad--text-sm">{fn.description}</p>
      {fn.examples.length > 0 && <label className="ad--block ad--text-sm">Example:</label>}
      {fn.examples.map((eg, idx) =>
        <div key={`${fn.name}-eg-${idx}`} style={{ marginTop: '-6px'}}>
          <div className="ad--w-full ad--px-5 ad--text-right" style={{ height: '13px'}}>
            <PreButton label="COPY" onClick={() => doCopy(eg)} tooltip="Copy this example to the clipboard"/>
            {onInsert && <PreButton label="ADD" onClick={() => onInsert(eg)} tooltip="Add this snippet to the end of the code"/>}
          </div>
          <pre
            className="ad--rounded-md ad--pl-4 ad--pr-30 ad--py-2 ad--mx-4 ad--my-0 ad--font-mono ad--bg-slate-100 ad--border-2 ad--border-slate-200 ad--text-slate-800 ad--min-h-full ad--text-xs ad--overflow-x-auto"
            >
              {eg}
          </pre>
        </div>
      )}
    </div>
  )
}

export default RenderFunction;