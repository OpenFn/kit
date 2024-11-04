// TODO rename the file to source mapping
// 1 function to get the position
// 1 function to extract the line from the source

import { SourceMapConsumer } from 'source-map';

const getMappedPosition = async (map, line, column) => {
  const smc = await new SourceMapConsumer(map);
  const pos = smc.originalPositionFor({
    line,
    column,
  });

  //return { line, col, src };
  return pos;
};

export default getMappedPosition;
