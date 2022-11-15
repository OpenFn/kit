// this is unit testable (although of course the describe-packaeg lookup is tricky)
import { useState, useEffect } from 'react';
import { describePackage } from '@openfn/describe-package';

const useDocs = (specifier: string) => {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    describePackage(specifier).then((result) => {
      console.log(result)
      setDocs(result.functions);
    });
  }, [specifier])

  return docs;
};

export default useDocs;