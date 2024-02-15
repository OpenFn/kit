const { readFileSync } = require('node:fs');
const { WebClient } = require('@slack/web-api');

//const SLACK_DEV = 'C05JTEE22H5';
const ENGINEERING = 'C05KZNPEJFN'; // this points to the new #devs channel
const IMPLEMENTATION = 'C017ELVRSM8';

const token = process.env.SLACK_TOKEN;
const slack = new WebClient(token);

const getEngineeringMessage = (changes) => {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🚀 *New Releases in kit*`,
      },
    },
    // TODO I'd like to link to a full changelog but we don't really have one
  ];

  const versions = changes.publishedPackages.map(
    (pkg) => `${pkg.version.padEnd(10)} ${pkg.name}`
  );

  const attachments = [
    {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `\`\`\`${versions.join('\n')}\`\`\``,
          },
        },
      ],
    },
  ];

  return {
    blocks,
    attachments,
    channel: ENGINEERING,
  };
};

const getImplementationMessage = (cliVersion, changes) => {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🚀 *New CLI Release: ${cliVersion}*`,
      },
    },
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
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Changelog:*',
          },
        },
      ],
    },
  ];

  changes.publishedPackages.forEach((pkg) => {
    const changelog = extractChangelog(pkg.name, pkg.version);
    if (changelog?.length) {
      attachments[0].blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${pkg.name} ${pkg.version}*\n${changelog}`,
        },
      });
    }
  });

  return {
    attachments,
    blocks,
    channel: IMPLEMENTATION,
  };
};

// If the returned changelog is empty, don't bother listing the changes
const extractChangelog = (package, version) => {
  const [_, name] = package.split('@openfn/');
  try {
    const log = readFileSync(`packages/${name}/CHANGELOG.md`, 'utf8').split(
      '\n'
    );
    let shouldParse = false;
    let skipDeps = false;
    const changes = [];
    for (const line of log) {
      if (skipDeps) {
        if (line.startsWith('  -')) {
          continue;
        } else {
          skipDeps = false;
        }
      }

      if (line.startsWith('- Updated dependencies')) {
        // Ignore all the dependency stuff
        skipDeps = true;
        continue;
      }
      if (line === `## ${version}`) {
        shouldParse = true;
      } else if (shouldParse && line.startsWith('## ')) {
        // This is the start of the next version, stop parsing
        break;
      } else if (shouldParse && line.length > 2 && !line.startsWith('#')) {
        changes.push(line);
      }
    }
    return changes.join('\n');
  } catch (e) {
    console.error(`Error reading changelog for ${package}:`);
    console.error(e);
    return [];
  }
};

const file = readFileSync('pnpm-publish-summary.json');
if (file) {
  const json = JSON.parse(file);
  if (json.publishedPackages.length) {
    console.log('Generating slack post for all changes (devs)');
    slack.chat.postMessage(getEngineeringMessage(json));

    const cli = json.publishedPackages.find(
      ({ name }) => name === '@openfn/cli'
    );
    if (cli) {
      console.log('Generating slack post for CLI changes (implementation)');
      slack.chat.postMessage(getImplementationMessage(cli.version, json));
    } else {
      console.log('No CLI changes detected, doing nothing');
    }
  }
}
