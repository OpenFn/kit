import React from 'react';
import DocsPanel from './DocsPanel';

type AdaptorDocsProps = {
    specifier?: string;
    onInsert?: (text: string) => void;
};

export default ({ specifier, onInsert }: AdaptorDocsProps) =>
  (<DocsPanel specifier={specifier} onInsert={onInsert} />)
