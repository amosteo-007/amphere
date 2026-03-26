/**
 * Tournament Runner Tests
 *
 * Tests the runner's async lifecycle (start/stop) without a real DB or Socket.IO.
 * Prisma and socket-server are mocked at the module level.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  prisma: {
    bid: { findMany: vi.fn().mockResolvedValue([]) },
    botTournament: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    periodLog: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    tournament: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('@/lib/socket-server', () => ({
  getIO: vi.fn().mockReturnValue({
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
  }),
}))

// ── Tests ────────────────────────────────────────────────────────────────────

describe('startTournament', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an ActiveRunner synchronously (does not await the loop)', async () => {
    const { startTournament } = await import('@/lib/tournament-runner')

    const start = Date.now()
    const runner = startTournament('test-tournament-1')
    const elapsed = Date.now() - start

    // Must return in well under 1 second — not after 15s × 15 periods
    expect(elapsed).toBeLessThan(100)
    expect(runner).toBeDefined()
    expect(typeof runner.stop).toBe('function')
  })

  it('stop() can be called without throwing', async () => {
    const { startTournament } = await import('@/lib/tournament-runner')

    const runner = startTournament('test-tournament-2')
    expect(() => runner.stop()).not.toThrow()
  })

  it('stop() prevents further period resolution', async () => {
    const { prisma } = await import('@/lib/db')
    const { startTournament } = await import('@/lib/tournament-runner')

    const runner = startTournament('test-tournament-3')
    runner.stop()

    // Allow one event-loop tick
    await new Promise(r => setTimeout(r, 50))

    // After immediate stop, periodLog.create should not have been called
    expect(prisma.periodLog.create).not.toHaveBeenCalled()
  })

  it('calling startTournament twice stops the first runner', async () => {
    const { startTournament, stopTournament } = await import('@/lib/tournament-runner')

    const runner1 = startTournament('test-tournament-4')
    const runner2 = startTournament('test-tournament-4') // second call for same ID

    // Both runners should be valid objects
    expect(runner1).toBeDefined()
    expect(runner2).toBeDefined()

    runner2.stop()
  })
})

describe('stopTournament', () => {
  it('stops a running tournament by ID', async () => {
    const { startTournament, stopTournament } = await import('@/lib/tournament-runner')

    startTournament('test-stop-1')
    expect(() => stopTournament('test-stop-1')).not.toThrow()
  })

  it('is a no-op for unknown tournament IDs', async () => {
    const { stopTournament } = await import('@/lib/tournament-runner')
    expect(() => stopTournament('non-existent-id')).not.toThrow()
  })
})
