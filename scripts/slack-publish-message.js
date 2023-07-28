const { readFileSync } = require('node:fs');
const { WebClient } = require('@slack/web-api');

const SLACK_DEV = 'C05JTEE22H5';

const token = process.env.SLACK_TOKEN;
const slack = new WebClient(token);

// TODO: ignore all dependency updates
// If the returned changelog is empty, don't bother listing the changes
const extractChangelog = (package, version) => {
  const [_, name] = package.split('@openfn/');
  const log = readFileSync(`packages/${name}/CHANGELOG.md`, 'utf8').split('\n');
  let shouldParse = false;
  const changes = [];
  for (const line of log) {
    if (line === `## ${version}`) {
      shouldParse = true;
    } else if (shouldParse && line.startsWith('## ')) {
      // This is the start of the next version, stop parsing
      break;
    } else if (shouldParse && line) {
      changes.push(line);
    }
  }
  return changes.join('\n');
};

const file = readFileSync('pnpm-publish-summary.json');
if (file) {
  const json = JSON.parse(file);

  const cli = json.publishedPackages.find(({ name }) => name === '@openfn/cli');
  if (cli) {
    console.log('Generating slack post for CLI changes');
    // Only post CLI changes!
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚀 *New CLI Release: ${cli.version}*`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'To upgrade run: `npm -g install @openfn/cli`',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'You can run `openfn test` to run a test job and verify your installed versions. If you have any trouble, uninstall the CLI with `npm remove -g @openfn.cli` and reinstall.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'If adaptors suddenly start breaking, try re-installing your repo with `openfn repo clean`',
        },
      },
    ];

    const attachments = [
      {
        // footer: 'Changelog',
        blocks: [],
      },
    ];

    json.publishedPackages.forEach((pkg) => {
      const changelog = extractChangelog(pkg.name, pkg.version);
      attachments[0].blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${pkg.name} ${pkg.version}*\n${changelog}`,
        },
      });
    });

    slack.chat.postMessage({
      attachments,
      blocks,
      channel: SLACK_DEV,
    });
  } else {
    console.log('No CLI changes detected, doing nothing');
  }
}
