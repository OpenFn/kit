// Note: this does not cover Windows reserved names (CON, NUL) or trailing dots
export default function slugify(text: string) {
  return (
    text
      ?.normalize('NFC')
      .trim()
      .toLowerCase()
      .replace(/\s/g, '-')
      // Handle characters Windows forbids in file names (\ : * ? " < > |)
      // and the path separator (/)
      .replace(/[/\\:*?"<>|]/g, '-')
      // a leading dot would create a hidden file or folder on posix
      .replace(/^\./, '-') ?? ''
  );
}
