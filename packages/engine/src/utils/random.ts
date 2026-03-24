/**
 * Simple seeded PRNG (xorshift128) for deterministic bot behavior.
 */
export class SeededRandom {
  private s: [number, number, number, number];

  constructor(seed: number) {
    // Initialize state from seed
    this.s = [seed | 0 || 1, (seed * 1664525 + 1013904223) | 0, (seed * 214013 + 2531011) | 0, (seed * 48271) | 0 || 1];
    // Warm up
    for (let i = 0; i < 20; i++) this.next();
  }

  private next(): number {
    let t = this.s[3];
    const s = this.s[0];
    this.s[3] = this.s[2];
    this.s[2] = this.s[1];
    this.s[1] = s;
    t ^= t << 11;
    t ^= t >>> 8;
    this.s[0] = t ^ s ^ (s >>> 19);
    return (this.s[0] >>> 0) / 4294967296;
  }

  /** Random float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Random integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Gaussian approximation via Box-Muller. */
  gaussian(mean: number = 0, stddev: number = 1): number {
    const u1 = this.next() || 0.0001;
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  }

  /** Pick random element from array. */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}
