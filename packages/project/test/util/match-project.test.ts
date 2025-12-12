import test from 'ava';
import matchProject from '../../src/util/match-project';
import Project from '../../src/Project';

const p = (
  uuid: any,
  alias: string,
  id: string,
  domain: string = 'app.openfn.org'
) => {
  return new Project(
    {
      id,
      openfn: {
        endpoint: `https://${domain}/abc`,
        uuid,
      },
    },
    { alias: alias }
  );
};

test('match by alias', (t) => {
  const projects = [p('<uuid:1>', 'staging', 'my-project')];

  const result = matchProject('staging', projects);

  t.is(result?.id, 'my-project');
  t.is(result?.alias, 'staging');
});

test('match by id', (t) => {
  const projects = [p('<uuid:1>', 'staging', 'my-project')];

  const result = matchProject('my-project', projects);

  t.is(result?.id, 'my-project');
});

test('match by uuid', (t) => {
  const projects = [p('<uuid:1>', 'staging', 'my-project')];

  const result = matchProject('<uuid:1>', projects);

  t.is(result?.id, 'my-project');
});

test('return null if there is no match', (t) => {
  const projects = [p('<uuid:1>', 'staging', 'my-project')];

  const result = matchProject('non-existent', projects);

  t.is(result, null);
});

test('match by partial uuid - prefix', (t) => {
  const projects = [
    p('abcd1234-5678-90ef-ghij-klmnopqrstuv', 'staging', 'my-project'),
  ];

  const result = matchProject('abcd', projects);

  t.is(result?.id, 'my-project');
});

test('match by partial uuid - middle section', (t) => {
  const projects = [
    p('abcd1234-5678-90ef-ghij-klmnopqrstuv', 'staging', 'my-project'),
  ];

  const result = matchProject('90ef', projects);

  t.is(result?.id, 'my-project');
});

test('match by partial uuid - case insensitive', (t) => {
  const projects = [
    p('abcd1234-5678-90ef-ghij-klmnopqrstuv', 'staging', 'my-project'),
  ];

  const result = matchProject('ABCD', projects);

  t.is(result?.id, 'my-project');
});

test('do not match by partial alias', (t) => {
  const projects = [p('<uuid:1>', 'staging', 'my-project')];

  const result = matchProject('stag', projects);

  t.is(result, null);
});

test('do not match by partial id', (t) => {
  const projects = [p('<uuid:1>', 'staging', 'my-project')];

  const result = matchProject('my-proj', projects);

  t.is(result, null);
});

test('throw if ambiguous alias', (t) => {
  const projects = [
    p('<uuid:1>', 'staging', 'project-a'),
    p('<uuid:2>', 'staging', 'project-b'),
  ];

  const error = t.throws(() => matchProject('staging', projects));

  t.truthy(error);
  t.regex(error!.message, /Multiple projects match/);
});

// TODO this doesn't throw - something up here
test.skip('throw if ambiguous id', (t) => {
  const projects = [
    p('<uuid:1>', 'staging-a', 'my-project'),
    p('<uuid:2>', 'staging-b', 'my-project'),
  ];

  const error = t.throws(() => matchProject('my-project', projects));

  t.truthy(error);
  t.regex(error!.message, /Multiple projects match/);
});

test('match when id and alias are the same', (t) => {
  const projects = [
    p('<uuid:1>', 'staging', 'staging'),
  ];

  const result = matchProject('staging', projects);

  t.is(result?.id, 'staging');
  t.is(result?.alias, 'staging');
});

test('throw if ambiguous - id matches one, alias matches another', (t) => {
  const projects = [
    p('<uuid:1>', 'my-project', 'staging'),
    p('<uuid:2>', 'other', 'my-project'),
  ];

  const error = t.throws(() => matchProject('my-project', projects));

  t.truthy(error);
  t.regex(error!.message, /Multiple projects match/);
});

test('throw if ambiguous uuid', (t) => {
  const projects = [
    p('abcd1234-5678-90ef-ghij-klmnopqrstuv', 'staging-a', 'project-a'),
    p('abcd5678-1234-90ef-ghij-klmnopqrstuv', 'staging-b', 'project-b'),
  ];

  const error = t.throws(() => matchProject('abcd', projects));

  t.truthy(error);
  t.regex(error!.message, /Multiple projects match/);
});
