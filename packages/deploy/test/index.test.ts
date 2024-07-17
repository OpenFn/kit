import { render } from '@inquirer/testing';
import { input } from '@inquirer/prompts';
import test from 'ava';
import { DeployConfig } from '../src/types';
import { getLightningUrl } from '../src/client';

test('renders a confirmation', async (t) => {
  const { answer, events, getScreen } = await render(input, {
    message: 'What is your name',
  });

  t.is(getScreen(), '? What is your name', 'should render message');
  events.type('J');
  events.type('ohn');
  events.keypress('enter');

  t.is(await answer, 'John');
});

test('getLightningUrl adds snapshots correctly to the URL', async (t) => {
  const config: DeployConfig = {
    endpoint: 'http://localhost',
    apiKey: 'test-api-key',
    specPath: './project.yaml',
    statePath: './state.json',
    requireConfirmation: false,
    dryRun: false,
  };

  const projectId = 'test-project';
  const snapshots = ['snapshot1', 'snapshot2'];

  const expectedUrl =
    'http://localhost/api/provision/test-project?snapshots%5B%5D=snapshot1&snapshots%5B%5D=snapshot2';
  t.is(getLightningUrl(config, projectId, snapshots).toString(), expectedUrl);
});

test('getLightningUrl returns the correct URL when no snapshot is provided', async (t) => {
  const config: DeployConfig = {
    endpoint: 'http://localhost',
    apiKey: 'test-api-key',
    specPath: './project.yaml',
    statePath: './state.json',
    requireConfirmation: false,
    dryRun: false,
  };

  const projectId = 'test-project';

  const expectedUrl = 'http://localhost/api/provision/test-project?';
  t.is(getLightningUrl(config, projectId).toString(), expectedUrl);
});
