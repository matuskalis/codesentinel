import { describe, it, expect } from 'vitest'
import { mapLineToPosition } from '@/lib/reporting/diff-position'

// ---------------------------------------------------------------------------
// mapLineToPosition
// ---------------------------------------------------------------------------

describe('mapLineToPosition', () => {
  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('should return null for empty string patch', () => {
    expect(mapLineToPosition('', 1)).toBeNull()
  })

  it('should return null for undefined-ish empty patch', () => {
    expect(mapLineToPosition('', 5)).toBeNull()
  })

  it('should return null when target line is not in the diff', () => {
    const patch = [
      '@@ -0,0 +1,3 @@',
      '+line 1',
      '+line 2',
      '+line 3',
    ].join('\n')
    // Line 5 does not exist in this diff (only lines 1-3)
    expect(mapLineToPosition(patch, 5)).toBeNull()
  })

  // -----------------------------------------------------------------------
  // New file (all additions)
  // -----------------------------------------------------------------------

  describe('new file (all additions)', () => {
    const patch = [
      '@@ -0,0 +1,10 @@',
      '+line 1',
      '+line 2',
      '+line 3',
      '+line 4',
      '+line 5',
      '+line 6',
      '+line 7',
      '+line 8',
      '+line 9',
      '+line 10',
    ].join('\n')

    it('should map line 1 to position 2 (first position is the @@ header)', () => {
      expect(mapLineToPosition(patch, 1)).toBe(2)
    })

    it('should map line 5 to position 6', () => {
      expect(mapLineToPosition(patch, 5)).toBe(6)
    })

    it('should map line 10 to position 11', () => {
      expect(mapLineToPosition(patch, 10)).toBe(11)
    })

    it('should return null for line 0', () => {
      expect(mapLineToPosition(patch, 0)).toBeNull()
    })

    it('should return null for line 11 (beyond diff)', () => {
      expect(mapLineToPosition(patch, 11)).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // Modified file with context lines
  // -----------------------------------------------------------------------

  describe('modified file with context', () => {
    // Simulates changing line 12 in the new file
    const patch = [
      '@@ -10,7 +10,7 @@',
      ' context line 10',
      ' context line 11',
      '-old line 12',
      '+new line 12',
      ' context line 13',
      ' context line 14',
      ' context line 15',
    ].join('\n')

    it('should map context line 10 to position 2', () => {
      expect(mapLineToPosition(patch, 10)).toBe(2)
    })

    it('should map context line 11 to position 3', () => {
      expect(mapLineToPosition(patch, 11)).toBe(3)
    })

    it('should map added line 12 to position 5', () => {
      // Position 1 = @@ header
      // Position 2 = context 10
      // Position 3 = context 11
      // Position 4 = deleted old line (does not advance newLine counter)
      // Position 5 = added new line 12
      expect(mapLineToPosition(patch, 12)).toBe(5)
    })

    it('should map context line 13 to position 6', () => {
      expect(mapLineToPosition(patch, 13)).toBe(6)
    })

    it('should map context line 15 to position 8', () => {
      expect(mapLineToPosition(patch, 15)).toBe(8)
    })

    it('should return null for line 9 (before the diff hunk)', () => {
      expect(mapLineToPosition(patch, 9)).toBeNull()
    })

    it('should return null for line 16 (after the diff hunk)', () => {
      expect(mapLineToPosition(patch, 16)).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // Deleted lines
  // -----------------------------------------------------------------------

  describe('deleted lines only', () => {
    const patch = [
      '@@ -5,5 +5,3 @@',
      ' context line 5',
      '-deleted line 6',
      '-deleted line 7',
      ' context line 6',  // this is new-file line 6 now
      ' context line 7',  // new-file line 7
    ].join('\n')

    it('should map context line 5 (new file) to position 2', () => {
      expect(mapLineToPosition(patch, 5)).toBe(2)
    })

    it('should map new-file line 6 to position 5', () => {
      // Position 1 = @@ header
      // Position 2 = context line 5
      // Position 3 = -deleted line 6 (no new line advance)
      // Position 4 = -deleted line 7 (no new line advance)
      // Position 5 = context line 6 (new-file line 6)
      expect(mapLineToPosition(patch, 6)).toBe(5)
    })

    it('should map new-file line 7 to position 6', () => {
      expect(mapLineToPosition(patch, 7)).toBe(6)
    })
  })

  // -----------------------------------------------------------------------
  // Multi-hunk patch
  // -----------------------------------------------------------------------

  describe('multi-hunk patch', () => {
    const patch = [
      '@@ -10,7 +10,7 @@',
      ' context line',
      '-old line',
      '+new line',
      ' context line',
      '@@ -30,6 +30,8 @@',
      ' context',
      '+added line 1',
      '+added line 2',
      ' context',
    ].join('\n')

    it('should map line 11 (new line in first hunk) to position 4', () => {
      // Hunk 1: pos1=@@, pos2=context(10), pos3=-old, pos4=+new(11)
      expect(mapLineToPosition(patch, 11)).toBe(4)
    })

    it('should map line 12 (context after change) to position 5', () => {
      expect(mapLineToPosition(patch, 12)).toBe(5)
    })

    it('should map line 31 (first addition in second hunk) to position 8', () => {
      // Hunk 2 starts at position 6 (@@), pos7=context(30), pos8=+added(31)
      expect(mapLineToPosition(patch, 31)).toBe(8)
    })

    it('should map line 32 (second addition in second hunk) to position 9', () => {
      expect(mapLineToPosition(patch, 32)).toBe(9)
    })

    it('should map context line 33 to position 10', () => {
      // After the two added lines, context resumes at new-file line 33
      expect(mapLineToPosition(patch, 33)).toBe(10)
    })

    it('should return null for line 20 (between hunks)', () => {
      expect(mapLineToPosition(patch, 20)).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // Real-world-like patch
  // -----------------------------------------------------------------------

  describe('real-world-like patch', () => {
    const patch = [
      '@@ -1,6 +1,8 @@',
      ' import React from "react"',       // line 1
      ' import { useState } from "react"', // line 2
      '+import { useEffect } from "react"', // line 3
      ' ',                                   // line 4
      ' export default function App() {',    // line 5
      '-  const [count, setCount] = useState(0)',
      '+  const [count, setCount] = useState(0)',  // line 6
      '+  const [name, setName] = useState("")',    // line 7
      ' ',                                           // line 8
    ].join('\n')

    it('should map the new import (line 3) correctly', () => {
      // pos1=@@, pos2=import React(1), pos3=import useState(2), pos4=+import useEffect(3)
      expect(mapLineToPosition(patch, 3)).toBe(4)
    })

    it('should map the new state line (line 7) correctly', () => {
      // pos5=space(4), pos6=export(5), pos7=-old const, pos8=+new const(6), pos9=+name state(7)
      expect(mapLineToPosition(patch, 7)).toBe(9)
    })

    it('should map the trailing context line (line 8)', () => {
      expect(mapLineToPosition(patch, 8)).toBe(10)
    })
  })

  // -----------------------------------------------------------------------
  // Pure addition hunk (no context, like adding to end of file)
  // -----------------------------------------------------------------------

  describe('additions without context', () => {
    const patch = [
      '@@ -50,0 +51,3 @@',
      '+new line 51',
      '+new line 52',
      '+new line 53',
    ].join('\n')

    it('should map line 51 to position 2', () => {
      expect(mapLineToPosition(patch, 51)).toBe(2)
    })

    it('should map line 53 to position 4', () => {
      expect(mapLineToPosition(patch, 53)).toBe(4)
    })
  })
})
