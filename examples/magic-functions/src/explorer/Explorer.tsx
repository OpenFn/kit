import React, { useState, useCallback, useEffect } from 'react';

import meta from '../editor/data/metadata-salesforce.json' assert { type: 'json'};

const Entity = ({ data }) => {

  return <li>
    <div>
      {data.name}
      {data.datatype && <i>({data.datatype})</i>}
    </div>
    {data.children && 
      <ul>{data.children.map((e) => <Entity data={e} key={e.name}  />)}</ul>
    }
  </li>
}

export default () => {
  const [filter, setFilter] = useState({ hideSystem: true });
  const [data, setData] = useState({ children: [] });

  const update = useCallback(() => {
    const filtered = meta.children.filter((e) => {
      if (filter.hideSystem) {
        return !e.meta.system;
      }
      return true;
    })
    setData({ ...meta, children: filtered });
  }, [filter]);

  const toggleSystem = useCallback((evt) => {
    const { checked } = evt.target;
    setFilter({ hideSystem: !checked });
  });

  useEffect(() => update(), [filter])
  
  return (
    <>
      <h1>{data.name}</h1>
      <p>
        <input type="checkbox" onChange={toggleSystem} />
        Show system children
      </p>
      <p>{data.children.length} children:</p>
      <ul>{data.children.map((e) => <Entity data={e} key={e.name} />)}</ul>
    </>
  )
}