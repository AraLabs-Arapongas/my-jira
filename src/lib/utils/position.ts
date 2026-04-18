// Compute a new position between two existing positions (or at the ends).
// Works for both column and task ordering.
export function midpoint(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return 1;
  if (prev === null) return (next as number) - 1;
  if (next === null) return prev + 1;
  return (prev + next) / 2;
}
