import { SourceMapConsumer } from 'source-map';
import { extractPositionForFrame, RTError } from '../errors';
import pick from './pick';
import type { Job } from '@openfn/lexicon';

// This function takes an error and a job and updates the error with sourcemapped metadata
export default async (job: Job, error: RTError) => {
  if (job.sourceMap) {
    const smc = await new SourceMapConsumer(job.sourceMap);

    if (error.pos && error.pos.line && error.pos.column) {
      error.pos = pick(
        smc.originalPositionFor({
          line: error.pos.line,
          column: error.pos.column,
        }) as any,
        'line',
        'column'
      );

      error.step = job.name || job.id;
    }

    if (error.stack) {
      error.stack = await mapStackTrace(smc, error.stack);
    }

    if (error.pos && !isNaN(error.pos.line!)) {
      // TODO how to handle file name properly here?
      const src = smc.sourceContentFor('src.js')!.split('\n');
      const line = src[error.pos.line! - 1];
      error.pos.src = line;
    }
  }
};

export const mapStackTrace = async (
  smc: SourceMapConsumer,
  stacktrace: string
) => {
  const lines = stacktrace.split('\n');

  const newStack = [lines.shift()]; // first line is the error message
  for (const line of lines) {
    try {
      const pos = extractPositionForFrame(line);
      // TODO not sure about these typings tbh
      const originalPos = smc.originalPositionFor({
        line: pos.line!,
        column: pos.column!,
      });
      newStack.push(
        line.replace(
          `${pos.line}:${pos.column}`,
          `${originalPos.line}:${originalPos.column}`
        )
      );
    } catch (e) {
      // do nothing
      newStack.push(line);
    }
  }

  return newStack.join('\n');
};
