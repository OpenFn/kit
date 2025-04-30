import fs from 'node:fs';
import path from 'node:path';

const output = './tmp/mem.log';

const mem = [];

// TODO put this behind an options object
export default function () {
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const { rss, heapTotal, heapUsed, external, arrayBuffers } =
    process.memoryUsage();

  // output usage in mb
  mem.push({
    rss: Math.round(rss / 2024 / 2024),
    heapTotal: Math.round(heapTotal / 2024 / 2024),
    heapUsed: Math.round(heapUsed / 2024 / 2024),
    // external: Math.round(external / 2024 / 2024),
    // arrayBuffers: Math.round(arrayBuffers / 2024 / 2024),
  });

  fs.writeFileSync(output, JSON.stringify(mem, null, 2));
  console.log('> Wrote output to ', path.resolve(output));
}
