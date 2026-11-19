/**
 * Small language detector for song lyrics: writing system first (Japanese, Korean, Chinese,
 * Russian, Arabic...), then the most common words for Latin-script languages.
 */

export type LanguageCode = 'en' | 'pt' | 'es' | 'fr' | 'de' | 'it' | 'ja' | 'ko' | 'zh' | 'ru' | 'ar' | 'hi';

const SCRIPTS: { code: LanguageCode; pattern: RegExp }[] = [
  { code: 'ja', pattern: /[぀-ヿ]/g },
  { code: 'ko', pattern: /[가-힯]/g },
  { code: 'zh', pattern: /[一-鿿]/g },
  { code: 'ru', pattern: /[Ѐ-ӿ]/g },
  { code: 'ar', pattern: /[؀-ۿ]/g },
  { code: 'hi', pattern: /[ऀ-ॿ]/g },
];

const STOPWORDS: Record<Exclude<LanguageCode, 'ja' | 'ko' | 'zh' | 'ru' | 'ar' | 'hi'>, string[]> = {
  en: ['the', 'and', 'you', 'i', 'to', 'me', 'my', 'it', 'is', 'that', 'in', 'of', 'your', 'we', 'on', 'what', 'love'],
  pt: ['que', 'não', 'eu', 'você', 'de', 'meu', 'minha', 'com', 'pra', 'um', 'uma', 'é', 'o', 'se', 'mais', 'te', 'nao', 'voce'],
  es: ['que', 'el', 'la', 'yo', 'tú', 'de', 'mi', 'con', 'para', 'un', 'una', 'es', 'y', 'lo', 'me', 'te', 'no', 'pero'],
  fr: ['je', 'tu', 'le', 'la', 'les', 'et', 'de', 'que', 'pas', 'un', 'une', 'est', 'mon', 'moi', 'toi', 'dans', 'qui'],
  de: ['ich', 'du', 'und', 'die', 'der', 'das', 'nicht', 'ist', 'mein', 'mich', 'dich', 'ein', 'eine', 'zu', 'mit', 'wir'],
  it: ['che', 'il', 'non', 'io', 'tu', 'di', 'mi', 'ti', 'per', 'un', 'una', 'è', 'e', 'con', 'sei', 'sono', 'ma'],
};

/** Below this share of characters, a script isn't considered the main one. */
const MIN_SCRIPT_SHARE = 0.3;
const MIN_WORDS = 20;
/** The best language must beat the second best by this factor to avoid guessing. */
const MIN_LEAD = 1.3;

export function detectLanguage(text: string): LanguageCode | null {
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
  if (letters.length === 0) return null;

  for (const { code, pattern } of SCRIPTS) {
    const matches = letters.match(pattern)?.length ?? 0;
    if (matches / letters.length >= MIN_SCRIPT_SHARE) return code;
  }

  const words = [...text.toLowerCase().matchAll(/[\p{L}']+/gu)].map(([word]) => word);
  if (words.length < MIN_WORDS) return null;

  const scores = Object.entries(STOPWORDS)
    .map(([code, stopwords]) => {
      const set = new Set(stopwords);
      return { code: code as LanguageCode, hits: words.filter((word) => set.has(word)).length };
    })
    .sort((a, b) => b.hits - a.hits);

  const [best, second] = scores;
  if (best.hits === 0 || best.hits < second.hits * MIN_LEAD) return null;
  return best.code;
}
