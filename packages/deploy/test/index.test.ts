import { render } from '@inquirer/testing';
import { input } from '@inquirer/prompts';
import test from 'ava';

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
