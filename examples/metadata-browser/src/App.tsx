import React, { useState, useCallback, useEffect } from 'react';

import meta from './metadata.json' assert { type: 'json'};

const Entity = ({ data }) => {

  return <li>
    <div>
      {data.name}
      {data.datatype && <i>({data.datatype})</i>}
    </div>
    {data.entities && 
      <ul>{data.entities.map((e) => <Entity data={e} key={e.name}  />)}</ul>
    }
  </li>
}

export default () => {
  const [filter, setFilter] = useState({ hideSystem: true });
  const [data, setData] = useState({ datasource: '', entities: [] });

  const update = useCallback(() => {
    const filtered = meta.entities.filter((e) => {
      if (filter.hideSystem) {
        return !e.system;
      }
      return true;
    })
    setData({ ...meta, entities: filtered });
  }, [filter]);

  const toggleSystem = useCallback((evt) => {
    const { checked } = evt.target;
    setFilter({ hideSystem: !checked });
  });

  useEffect(() => update(), [filter])
  
  return (
    <>
      <h1>{data.datasource}</h1>
      <p>
        <input type="checkbox" onChange={toggleSystem} />
        Show system entities
      </p>
      <p>{data.entities.length} entities:</p>
      <ul>{data.entities.map((e) => <Entity data={e} key={e.name} />)}</ul>
    </>
  )
}