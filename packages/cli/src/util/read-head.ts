import fs from 'fs';
import readline from 'readline';

export default async function readHead(path: fs.PathLike, linesCount = 10) {
  const fileStream = fs.createReadStream(path);
  const rl = readline.createInterface({ input: fileStream });
  const lines = [];

  for await (const line of rl) {
    lines.push(line);
    if (lines.length >= linesCount) {
      rl.close();
      break;
    }
  }
  return lines.join('\n');
}
