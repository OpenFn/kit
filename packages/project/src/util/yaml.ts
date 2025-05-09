import yaml from 'yaml';

export function yamlToJson(y: string) {
  const doc = yaml.parseDocument(y);
  return doc.toJS();
}

export function jsonToYaml(json: string | JSONObject) {
  if (typeof json === 'string') {
    json = JSON.parse(json);
  }

  const doc = new yaml.Document(json);
  return yaml.stringify(doc, null, 2);
}
