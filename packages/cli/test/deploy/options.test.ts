import test from 'ava';
import yargs from 'yargs';
import deploy, { DeployOptions } from '../../src/deploy/command';

const cmd = yargs().command(deploy as any);

const parse = (command: string) =>
  cmd.parse(command) as yargs.Arguments<DeployOptions>;

test('correct default options', (t) => {
  const options = parse('deploy');

  t.is(options.command, 'deploy');
  t.is(options.statePath, './state.json');
  t.is(options.projectPath, './project.yaml');
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
  const options = parse('deploy -s other_config.json');
  t.deepEqual(options.configPath, 'other_config.json');
});
