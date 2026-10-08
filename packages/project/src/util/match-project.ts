import { UUID } from '@openfn/lexicon';
import Project from '../Project';

type Alias = string;
type ID = string;

export class MultipleMatchingProjectsError extends Error {}

const matchProject = (name: Alias | ID | UUID, candidates: Project[]) => {
  const [searchTerm, domain] = `${name}`.split('@');

  const re = new RegExp(searchTerm, 'i');
  const matches = candidates.filter(
    (project) =>
      (!domain || project.host === domain) &&
      (project.id === searchTerm ||
        project.alias === searchTerm ||
        (project.uuid && re.test(project.uuid)))
  );

  if (matches.length > 1) {
    // Aliases come from file names, so an exact alias match picks out one
    // local copy of a project, even if other copies share its id or uuid
    const aliasMatches = matches.filter((p) => p.alias === searchTerm);
    if (
      aliasMatches.length === 1 &&
      matches.every((p) => p.uuid === aliasMatches[0].uuid)
    ) {
      return aliasMatches[0];
    }

    throw new MultipleMatchingProjectsError(
      `Failed to resolve unique identifier for "${name}", clashes with: ${matches
        .map((p) => p.qname)
        .join(', ')}. Use alias@domain or a path instead`
    );
  }
  return matches.length ? matches[0] : null;
};

export default matchProject;
