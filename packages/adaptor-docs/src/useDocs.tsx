import { useState, useEffect } from 'react';
import { describePackage, FunctionDescription } from '@openfn/describe-package';

const useDocs = (specifier: string) => {
  const [docs, setDocs] = useState<FunctionDescription[]>([]);

  useEffect(() => {
    describePackage(specifier, {}).then((result) => {
      console.log(result)
      setDocs(result.functions as FunctionDescription[]); // ??
    });
  }, [specifier])

  return docs;
};

export default useDocs;