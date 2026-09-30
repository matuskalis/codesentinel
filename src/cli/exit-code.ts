export const EXIT_BLOCKING = 1
export const EXIT_INCOMPLETE = 3

// A scan that was cut short never counts as a pass: nothing is known about the files it did not reach.
export function exitCodeFor(blockingCount: number, filesNotScanned: number): number {
  if (blockingCount > 0) return EXIT_BLOCKING
  if (filesNotScanned > 0) return EXIT_INCOMPLETE
  return 0
}
