import mapUuids from './map-uuids';

type Options = {
  workflows: string[]; // A list of workflows to merge
};

/**
 * This is the main merge function: merge source -> target
 *
 * This top level function must be highly readable and algorithmic
 *
 * It should be a reference implementation used by other tools
 *
 * Return a new project which has all the nodes and values of the
 * target, but the UUIDs of the source
 */
export default function merge(source, target, options = {}) {
  // create a new project

  // for each workflow required (either all or in options)

  const idmap = mapUuids(source_wf, target_wf);

  // id map is like:
  // source id: target uuid
  // { x: uuid_main }

  // copy it
  // keep the uuid of the target
  // for each step in the source:
  //    copy it into the target
  //    remove the UUID id (actually the whole openfn object I think)
  //    from the map, set the new UUID (or generate a new one)
  // add to the new project

  // return the new project
  return source;
}
