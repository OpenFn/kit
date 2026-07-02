import test from 'ava';
import detectVersion from '../../src/util/detect-version';

test('detects v1 from a JSON object', (t) => {
  const project = {
    id: '1234',
    name: 'My Project',
    workflows: {},
    project_credentials: [],
  };
  const version = detectVersion(project);
  t.is(version, 1);
});

test('detects v1 from a YAML string', (t) => {
  const project = `
  id: '1234'
  name: My Project
  workflows: {}
  project_credentials: []`;
  const version = detectVersion(project);
  t.is(version, 1);
});

test('detects v1 from a JSON string', (t) => {
  const project = JSON.stringify({
    id: '1234',
    name: 'My Project',
    workflows: {},
  });
  const version = detectVersion(project);
  t.is(version, 1);
});

test('detects v2 via schema_version from a JSON object', (t) => {
  const project = {
    id: 'my-project',
    name: 'My Project',
    schema_version: '4.0',
    workflows: [],
  };
  const version = detectVersion(project);
  t.is(version, 4);
});

test('detects v2 via schema_version from a YAML string', (t) => {
  const project = `id: my-project\nname: My Project\nschema_version: '4.0'\nworkflows: []\n`;
  const version = detectVersion(project);
  t.is(version, 4);
});

test('detects v2 via cli.version === 2 (legacy format)', (t) => {
  const project = { id: 'x', name: 'x', cli: { version: 2 }, workflows: [] };
  const version = detectVersion(project);
  t.is(version, 2);
});

test('does not detect v2 for cli.version !== 2', (t) => {
  const project = { id: 'x', name: 'x', cli: { version: 1 }, workflows: {} };
  const version = detectVersion(project);
  t.is(version, 1);
});

test('detects v2 via deprecated version field', (t) => {
  const project = { id: 'x', name: 'x', version: '1.0', workflows: [] };
  const version = detectVersion(project);
  t.is(version, 2);
});
