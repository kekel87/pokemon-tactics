const MAX_CLIMB = 0.5;
const MAX_DESCENT = 1.0;

export function canTraverse(fromHeight: number, toHeight: number, isFlying: boolean): boolean {
  if (isFlying) {
    return true;
  }

  const delta = toHeight - fromHeight;

  if (delta > 0) {
    return delta <= MAX_CLIMB;
  }

  return -delta <= MAX_DESCENT;
}
