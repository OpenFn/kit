/**
 * Convert a human-readable name into a slug used as an identifier.
 *
 * Any run of characters which is neither a letter, a digit nor an underscore
 * becomes a separator. Letters and digits are matched with the Unicode
 * properties `\p{L}` and `\p{N}` rather than `\w`, which is ASCII-only and
 * would drop every non-Latin character: `café` slugified to `caf`, and a name
 * written entirely in a non-Latin script collapsed to an empty string.
 *
 * For ASCII-only input this produces exactly the same slug as before, so
 * identifiers in existing projects are unaffected.
 */
export default function slugify(text: string) {
  return (
    text
      ?.replace(/[^\p{L}\p{N}_]+/gu, ' ')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() ?? ''
  );
}
