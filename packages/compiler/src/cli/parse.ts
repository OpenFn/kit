// Very simple cli to test parsing functionality
import fs from 'node:fs';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers'
import parse from '../parse';

type Args = {
  _: string[];
  e?: boolean;
  t?: string;
  o?: string;
}

const args = yargs(hideBin(process.argv))
  .command('[path]' , "parse the file at path")
  .positional('path', {
    describe: "The path to parse",
  })
  .option('expression', {
    alias: 'e',
    boolean: true,
    description: 'treat the input as an expresssion, not a path',
  })
  .option('', {
    alias: 'o',
    description: 'output the result to file',
  })
  .option('test', {
    alias: 't',
    description: 'output the result as a test ast'
  })
  .example('parse -t simple-expression my-src.json', 'parse my-src.json into a test sat called simple-expression.json')
  .example('parse -e "const x=10"', 'parse the expression "const x=10" and write the results to stdout')
  
  .parse() as Args;

const inputPath  =  args._[0];
let expression = inputPath;
if (!args.e) {
  expression = fs.readFileSync(inputPath, 'utf8');
}

const result = parse(expression);

// TODO write output to disk
let output: { result: string, path: string | null }
if (args.t) {
  console.log(`Creating test AST called ${args.t}.json`)
  output = {
    result: JSON.stringify(result),
    path: path.resolve(`test/asts/${args.t}.json`)
  }
}
else {
  output = {
    result: JSON.stringify(result, null, 2),
    path: args.o ? path.resolve(args.o) : null
  }
}

if (output.path) {
  console.log('Writing output to', output.path)
  fs.writeFileSync(
    output.path,
    output.result,
    { flag: 'w+'}
  );  
} else {
  console.log(output.result)
}