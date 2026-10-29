export default function slugify(text: string) {
  return (
    text
      ?.normalize('NFC')
      .trim()
      .toLowerCase()
      .replace(/[\s/\\:*?"<>|]/g, '-')
      .replace(/^\./, '-') ?? ''
  );
}
