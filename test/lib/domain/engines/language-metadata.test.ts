import { describe, expect, it } from 'vitest';
import { detectLanguage } from '@/lib/domain/engines/language';
import { summarizeMetadata } from '@/lib/domain/engines/metadata-insights';

const repeat = (text: string, times = 4) => Array(times).fill(text).join('\n');

describe('detectLanguage', () => {
  it.each([
    ['en', repeat("I love you and you know that it is the way that we go on and on in my heart")],
    ['pt', repeat('Eu não sei o que fazer com você, meu amor, pra mim é mais que uma paixão')],
    ['es', repeat('Yo no sé qué hacer contigo, mi amor, pero te quiero y lo sabes con el corazón')],
    ['fr', repeat("Je ne sais pas pourquoi tu es dans mon coeur, mais moi je t'aime et toi pas")],
    ['de', repeat('Ich weiß nicht, warum du mich nicht liebst, und die Nacht ist mein Leben mit dir')],
    ['it', repeat('Io non so che cosa fare per te, ma sei il mio amore e ti voglio con me')],
    ['ja', 'あなたのことが好きです。ずっとそばにいたい'],
    ['ko', '사랑해요 당신을 영원히 함께하고 싶어요'],
    ['zh', '我爱你，永远在一起，月亮代表我的心'],
    ['ru', 'Я люблю тебя, и ты знаешь это'],
    ['ar', 'أحبك كثيرا يا حبيبي'],
    ['hi', 'मैं तुमसे प्यार करता हूँ'],
  ] as const)('detects %s', (language, text) => {
    expect(detectLanguage(text)).toBe(language);
  });

  it('does not guess with too little or ambiguous text', () => {
    expect(detectLanguage('')).toBeNull();
    expect(detectLanguage('la la la')).toBeNull();
    expect(detectLanguage(repeat('xyz qwe rty uio pak dfg hjk lzx cvb nmq', 3))).toBeNull();
    expect(detectLanguage(repeat('que de que de que de que de que de', 3))).toBeNull();
  });
});

describe('summarizeMetadata', () => {
  it('summarizes original decades, shared tags and shared credits', () => {
    const producer = { name: 'Max Martin', role: 'producer' };
    const insights = summarizeMetadata([
      { originalYear: 1995, tags: ['pop', 'pop', 'dance'], credits: [producer, producer, { name: 'Guitarist', role: 'instrument' }], artistId: null },
      { originalYear: 2001, tags: ['pop', 'rock'], credits: [producer], artistId: 'a' },
      { originalYear: null, tags: ['rock'], credits: [{ name: 'Solo', role: 'mix' }], artistId: null },
    ]);
    expect(insights).toEqual({
      coveredTracks: 3,
      originalDecadeDistribution: { '1990s': 1, '2000s': 1 },
      topTags: [
        { tag: 'pop', tracks: 2 },
        { tag: 'rock', tracks: 2 },
      ],
      topCredits: [{ name: 'Max Martin', role: 'producer', tracks: 2 }],
    });
  });
});
