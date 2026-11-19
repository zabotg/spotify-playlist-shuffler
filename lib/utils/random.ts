export type RandomSource = () => number;

export function randomIndex(length: number, random: RandomSource = Math.random): number {
  return Math.floor(random() * length);
}

export function shuffleArray<T>(items: readonly T[], random: RandomSource = Math.random): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = randomIndex(index + 1, random);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
