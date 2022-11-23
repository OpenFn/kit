import React, { useState } from 'react';
import AdaptorDocs from '@openfn/adaptor-docs';
import '@openfn/adaptor-docs/index.css';

const initialSpecifier = "@openfn/language-common@1.7.4";

const inputStyle = { width: '400px', padding: '6px 4px', border: 'solid 1px slategrey' };

export default () => {
  const [specifier, setSpecifier] = useState(initialSpecifier);

  const handleAdaptorChanged = (evt) => {
    setSpecifier(evt.target.value)
  }

  return (
    <div style={{ margin: '8px' }}>
      <select
        style={inputStyle}
        onChange={handleAdaptorChanged}
        >
          <option>{initialSpecifier}</option>
          <option>@openfn/language-primero@2.10.2</option>
          </select>
      <AdaptorDocs specifier={specifier} onInsert={console.log}/>
    </div>
  )
}