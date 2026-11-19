/** Lowercase, no accents, no "(feat. ...)" / "- Remastered" suffixes, letters and digits only. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]|\s-\s.*$/g, '')
    .replace(/[^a-z0-9]/g, '');
}
