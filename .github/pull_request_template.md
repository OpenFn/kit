## Short Description

A one or two-sentence description of what this PR does.

Fixes #

## Implementation Details

A more detailed breakdown of the changes, including motivations (if not provided in the issue).

## QA Notes

List any considerations/cases/advice for testing/QA here.

## AI Usage

Please disclose whether you've used AI anywhere in this PR (it's cool, we just
want to know!):

- [ ] I have used Claude Code
- [ ] I have used another model
- [ ] I have not used AI

You can read more details in our
[Responsible AI Policy](https://www.openfn.org/ai#pull-request-templates)

## Release branch checklist

Delete this section if this is not a release PR.

If this IS a release branch:

- [ ] Run `pnpm changeset version` from root to bump versions
- [ ] Run `pnpm install`
- [ ] Commit the new version numbers
- [ ] Run `pnpm changeset tag` to generate tags
- [ ] Push tags `git push --tags`

Tags may need updating if commits come in after the tags are first generated.
