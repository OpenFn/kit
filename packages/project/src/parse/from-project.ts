import * as l from '@openfn/lexicon';

import Project from '../Project';
import ensureJson from '../util/ensure-json';
import { Provisioner } from '@openfn/lexicon/lightning';
import fromAppState from './from-app-state';

export default (data: l.Project | string) => {
  // first ensure the data is in JSON format
  let rawJson = ensureJson<any>(data);

  let json;
  if (rawJson.version) {
    // If there's any version key at all, its at least v2
    json = from_v2(rawJson as Project);
  } else {
    json = from_v1(rawJson as Provisioner.Project);
  }

  return new Project(json);
};

const from_v1 = (data: Provisioner.Project) => {
  // TODO is there any way to look up the config file?
  // But we have no notion of a working dir here
  // Maybe there are optional options that can be provided
  // by from fs or from path
  return fromAppState(data);
};

const from_v2 = (data: l.Project) => {
  // nothing to do
  // (When we add v3, we'll ned to migrate through this)
  return data;
};
