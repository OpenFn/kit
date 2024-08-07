import test from 'ava';
import yargs from 'yargs';
import configCommand, { ConfigOptions } from '../../src/configuration/command'


const cmd = yargs().command(configCommand as any);

const parse = (command: string) =>
  cmd.parse(command) as yargs.Arguments<ConfigOptions>;

test('correct adaptor options', (t) => {
  const options = parse('configuration @openfn/language-dhis2@4.0.3');

  t.is(options.command, 'configuration')
  t.is(options.adaptor, '@openfn/language-dhis2@4.0.3')
  t.is(options.configType, 'both')
  t.is(options.logJson, undefined)
  t.is(options.outputPath, undefined)
})

test('correct output path options', (t) => {
  const options = parse('configuration @openfn/language-dhis2@4.0.3 -o output.json');

  t.is(options.command, 'configuration')
  t.is(options.adaptor, '@openfn/language-dhis2@4.0.3')
  t.is(options.configType, 'both')
  t.is(options.logJson, undefined)
  t.is(options.outputPath, 'output.json')
})

test('correct config type', (t) => {
  const options = parse('configuration @openfn/language-dhis2@4.0.3 -o output.json --config-type sample');

  t.is(options.command, 'configuration')
  t.is(options.adaptor, '@openfn/language-dhis2@4.0.3')
  t.is(options.configType, 'sample')
  t.is(options.logJson, undefined)
  t.is(options.outputPath, 'output.json')
})

test('correct config type for a shortcut command', (t) => {
  const options = parse('configuration @openfn/language-dhis2@4.0.3 -o output.json --schema');

  t.is(options.command, 'configuration')
  t.is(options.adaptor, '@openfn/language-dhis2@4.0.3')
  t.is(options.configType, 'schema')
  t.is(options.logJson, undefined)
  t.is(options.outputPath, 'output.json')
})