export default function slugify(text: string) {
  return text?.replace(/\W/g, ' ').trim().replace(/\s+/g, '-').toLowerCase();
}
