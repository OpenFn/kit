// TODO rename the file to source mapping
// 1 function to get the position
// 1 function to extract the line from the source

import { SourceMapConsumer } from 'source-map';
import { extractPositionForFrame } from '../errors';

export const getMappedPosition = async (map, line, column) => {
  // TODO take consumer creation out of here and let this be sync
  // Can replace the map with the consumer
  const smc = await new SourceMapConsumer(map);
  const pos = smc.originalPositionFor({
    line,
    column,
  });

  return { line, col: pos.column/*, src*/ };
  // return pos;
};

export const mapStackTrace  = async (map, stacktrace: string) => {
  const lines = stacktrace.split('\n')

  const newStack = [lines.shift()]; // first line is the error message
  for(const line of lines) {
    debugger;
    try {
      const pos = extractPositionForFrame(line);
      const originalPos = await getMappedPosition(map, pos.line, pos.col);
      newStack.push(line.replace(`${pos.line}:${pos.col}`, `${originalPos.line}:${originalPos.col}`))
    } catch(e) {
      // do nothing
      newStack.push(line)
    }
  }

  return newStack.join('\n')

}

export default getMappedPosition;
