/**
 * Identify identical nodes in two projects
 *
 * this function will take two workflows
 * and it'll return a map of step and edge UUIDs in A
 * and how they map to B
 *
 * If step names stay the same, this is trivial
 */

// changing parent and changing id is probably a new node
// changing id but preserving parent should map
// adding a new node an changing the id... an we track this?

// null: this item does not exist in B
// string: this item maps to this ID in B (could be the same)
// true: this item needs a new UUID in B
type MappingRule = null | string;

type Map = Record<string, MappingRule>;

export default (a: Project, b: Project) => {
  // first of we handle all simple mappings
  const map: Map = {};

  // go over each UUID of A and see if you can map it to something in B

  // What anything

  // Anything left over doesn't have a mapping in B and should be removed

  // If there's anything in B that isn;t in the map, flag it for creation

  return map;
};

// Get an array of all UUIDS
const extractUUIDS = (p: Project) => {};
