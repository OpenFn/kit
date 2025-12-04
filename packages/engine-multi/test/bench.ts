#!/usr/bin/env bun
import { $ } from 'bun';

const count = parseInt(process.argv[2] ?? '10');

async function run(algo) {
  // Run the command and capture both stdout and stderr
  const proc =
    await $`/usr/bin/time -v pnpm tsx test/payload.ts ${algo}`.quiet();

  // time -v outputs to stderr
  const output = proc.stderr.toString();

  // Extract user time (in seconds)
  const userTimeMatch = output.match(/User time \(seconds\): ([\d.]+)/);
  const userTime = userTimeMatch ? parseFloat(userTimeMatch[1]) : null;

  // Extract maximum resident set size (in KB)
  const maxRssMatch = output.match(
    /Maximum resident set size \(kbytes\): (\d+)/
  );
  const maxRss = maxRssMatch ? parseInt(maxRssMatch[1]) : null;

  // Create JSON output
  return {
    time: userTime,
    mem: maxRss,
  };
}

async function bench(algo: string) {
  console.log(`\n==RUNNING BENCHMARK FOR ${algo.toUpperCase()}==\n`);

  // one once to warm any caching - the very first run is often slowe
  await run(algo);

  // Run 10 times and collect results
  const results = [];
  for (let i = 0; i < count; i++) {
    const result = await run(algo);
    results.push(result);
    console.log(`Run ${i + 1}: used ${result.mem}kb in ${result.time}ms`);
  }

  // Calculate statistics
  const times = results.map((r) => r.time || 0);
  const mems = results.map((r) => r.mem || 0);

  const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  const avgMem = mems.reduce((sum, m) => sum + m, 0) / mems.length;
  const minMem = Math.min(...mems);
  const maxMem = Math.max(...mems);

  const stats = {
    time: { min: minTime, max: maxTime, avg: avgTime },
    mem: { min: minMem, max: maxMem, avg: avgMem },
  };

  console.log(`\n${algo} results:`);
  console.log(
    `  Time (ms): min=${minTime.toFixed(2)}, max=${maxTime.toFixed(
      2
    )}, avg=${avgTime.toFixed(2)}`
  );
  console.log(
    `  Memory (MB): min=${(minMem / 1024).toFixed(2)}, max=${(
      maxMem / 1024
    ).toFixed(2)}, avg=${(avgMem / 1024).toFixed(2)}`
  );
  console.log();

  return stats;
}

const stringifyStats = await bench('stringify');
const traverseStats = await bench('traverse');
const streamStats = await bench('stream');

// Calculate percentage differences (traverse vs stringify baseline)
function calcDiff(baseline: number, comparison: number) {
  return (((comparison - baseline) / baseline) * 100).toFixed(2);
}

console.log('\n=== COMPARISON (traverse vs stringify baseline) ===\n');

console.log('Time Performance:');
console.log(
  `  Min: ${calcDiff(stringifyStats.time.min, traverseStats.time.min)}%`
);
console.log(
  `  Max: ${calcDiff(stringifyStats.time.max, traverseStats.time.max)}%`
);
console.log(
  `  Avg: ${calcDiff(stringifyStats.time.avg, traverseStats.time.avg)}%`
);

console.log('\nMemory Usage:');
console.log(
  `  Min: ${calcDiff(stringifyStats.mem.min, traverseStats.mem.min)}%`
);
console.log(
  `  Max: ${calcDiff(stringifyStats.mem.max, traverseStats.mem.max)}%`
);
console.log(
  `  Avg: ${calcDiff(stringifyStats.mem.avg, traverseStats.mem.avg)}%`
);

console.log('\n(Negative values mean traverse is better)');

console.log('\n=== COMPARISON (stream vs stringify baseline) ===\n');

console.log('Time Performance:');
console.log(
  `  Min: ${calcDiff(stringifyStats.time.min, streamStats.time.min)}%`
);
console.log(
  `  Max: ${calcDiff(stringifyStats.time.max, streamStats.time.max)}%`
);
console.log(
  `  Avg: ${calcDiff(stringifyStats.time.avg, streamStats.time.avg)}%`
);

console.log('\nMemory Usage:');
console.log(
  `  Min: ${calcDiff(stringifyStats.mem.min, streamStats.mem.min)}%`
);
console.log(
  `  Max: ${calcDiff(stringifyStats.mem.max, streamStats.mem.max)}%`
);
console.log(
  `  Avg: ${calcDiff(stringifyStats.mem.avg, streamStats.mem.avg)}%`
);

console.log('\n(Negative values mean stream is better)');
