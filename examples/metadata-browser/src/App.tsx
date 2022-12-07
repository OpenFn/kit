import React from 'react';

import meta from './metadata.json' assert { type: 'json'};

const Entity = ({ data }) => {

  return <li>
    <div>
      {data.name}
      {data.datatype && <i>({data.datatype})</i>}
    </div>
    {data.entities && 
      <ul>{data.entities.map((e) => <Entity data={e} />)}</ul>
    }
  </li>
}

export default () => {
  console.log(meta)

  return (
    <>
      <h1>{meta.datasource}</h1>
      <div>{meta.entities.length} root entities:</div>
      <ul>{meta.entities.map((e) => <Entity data={e} />)}</ul>
    </>
  )
}