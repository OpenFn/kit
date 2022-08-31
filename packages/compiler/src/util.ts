import fs from 'node:fs';
import path from 'node:path';

export const loadFile = (filePath: string) => fs.readFileSync(path.resolve(filePath), 'utf8');

// Detect if we've been handed a file path or some code
// It's a path if it has no linebreaks and ends in .js
export const isPath = (pathOrCode: string) => 
  // No line breaks
  !/(\r|\n|\r\n)/.test(pathOrCode)
  // End in .js or ojs
  && /(ts|js|ojs)$/.test(pathOrCode)
