import React from 'react';
import DocsPanel from './DocsPanel';

type AdaptorDocsProps = {
    specifier?: string;
};

export default ({ specifier }: AdaptorDocsProps) =>
  (<DocsPanel specifier={specifier} />)
