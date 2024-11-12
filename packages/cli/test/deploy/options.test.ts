import test from 'ava';
import yargs from 'yargs';
import deployCommand, { DeployOptions } from '../../src/deploy/command';

const cmd = yargs().command(deployCommand as any);

const parse = (command: string) =>
  cmd.parse(command) as yargs.Arguments<DeployOptions>;

test('correct default options', (t) => {
  const options = parse('deploy');

  t.is(options.command, 'deploy');
  t.is(options.statePath, undefined);
  t.is(options.projectPath, undefined);
  t.is(options.configPath, './.config.json');
  t.falsy(options.logJson); // TODO this is undefined right now
});

test('pass a state path (longform)', (t) => {
  const options = parse('deploy --state-path other_state.json');
  t.deepEqual(options.statePath, 'other_state.json');
});

test('pass a state path (shortform)', (t) => {
  const options = parse('deploy -s other_state.json');
  t.deepEqual(options.statePath, 'other_state.json');
});

test('pass a config path (longform)', (t) => {
  const options = parse('deploy --config other_config.json');
  t.deepEqual(options.configPath, 'other_config.json');
});

test('pass a config path (shortform)', (t) => {
  const options = parse('deploy -c other_config.json');
  t.deepEqual(options.configPath, 'other_config.json');
});

test('pass a spec path (longform)', (t) => {
  const options = parse('deploy --project-path test-project.yaml');
  t.deepEqual(options.projectPath, 'test-project.yaml');
});

test('pass a spec path (shortform)', (t) => {
  const options = parse('deploy -p test-project.yaml');
  t.deepEqual(options.projectPath, 'test-project.yaml');
});
