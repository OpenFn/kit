import { describePackage } from './api';

const a = process.argv[2];

async function run(specifier: string) {
  const result = await describePackage(specifier, {});

  console.log(result);
}

console.log('GENERATING FOR', a);
run(a);
