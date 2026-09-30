import { describe, it, expect } from 'vitest'
import { EXIT_INCOMPLETE, exitCodeFor } from '@/cli/exit-code'

describe('exitCodeFor', () => {
  it('is 0 when the scan finished and nothing blocks', () => {
    expect(exitCodeFor(0, 0)).toBe(0)
  })

  it('is 1 when a finding blocks', () => {
    expect(exitCodeFor(2, 0)).toBe(1)
  })

  it('is 3 when the scan was cut short and nothing in the scanned part blocks', () => {
    expect(exitCodeFor(0, 40)).toBe(EXIT_INCOMPLETE)
    expect(EXIT_INCOMPLETE).toBe(3)
  })

  it('is 1 when a finding blocks even though the scan was cut short', () => {
    expect(exitCodeFor(1, 40)).toBe(1)
  })
})
