export type RandomFn = () => number;

export function createPrng(seed: number): RandomFn {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let intermediate = Math.imul(state ^ (state >>> 15), 1 | state);
    intermediate =
      (intermediate + Math.imul(intermediate ^ (intermediate >>> 7), 61 | intermediate)) ^
      intermediate;
    return ((intermediate ^ (intermediate >>> 14)) >>> 0) / 4294967296;
  };
}
