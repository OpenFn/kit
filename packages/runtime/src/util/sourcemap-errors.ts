import { SourceMapConsumer } from 'source-map';
import { extractPositionForFrame, RTError } from '../errors';
import pick from './pick';
import type { Job } from '@openfn/lexicon';

// This function takes an error and a job and updates the error with sourcemapped metadata
export default async (job: Job, error: RTError) => {
  if (job.sourceMap) {
    try {
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
        const fileName = `${job.name || job.id || 'src'}.js`;
        const content = smc.sourceContentFor(fileName, true);
        if (content) {
          const src = content.split('\n');
          const line = src[error.pos.line! - 1];
          error.pos.src = line;
        }
      }
    } catch (e) {
      // error while trying to map
      // (we must not throw  here or we'll create more problems)
      console.warn(
        'Error occurred trying to resolve sourcemap for ',
        job.name || job.id
      );
      console.warn(e);
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
      if (pos) {
        // TODO not sure about these typings tbh
        const originalPos = smc.originalPositionFor({
          line: pos.line!,
          column: pos.column!,
        });
        if (originalPos.line && originalPos.column) {
          newStack.push(
            line.replace(
              `${pos.line}:${pos.column}`,
              `${originalPos.line}:${originalPos.column}`
            )
          );
        } else {
          newStack.push(line);
        }
      }
    } catch (e) {
      // do nothing
      newStack.push(line);
    }
  }

  return newStack.join('\n');
};
