type Options = {
  workflows: string[]; // A list of workflows to merge
};

/**
 * This is the main merge function
 *
 * This top level function must be highly readable and algorithmic
 *
 * It should be a reference implementation used by other tools
 *
 * Return a new project which has all the nodes and values of the
 * target, but the UUIDs of the source
 */
export default function merge(source, target, options = {}) {
  // Get a list lof workflows to merge (based on options)
  // For each workflow, map source nodes (steps and edges)
  // to target nodes.
  // Note that we need to handle triggers somehow too
  // Merge the properties of each node
  // Including UUIDs
  // return a new project with the merged state
  return source;
}
