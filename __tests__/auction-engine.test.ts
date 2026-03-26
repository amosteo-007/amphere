/**
 * Auction Engine Tests
 *
 * Tests the Vickrey multi-stage token auction tournament logic.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  resolvePeriod,
  calculateWeightedPoints,
  canRescind,
  generateTurnId,
  STAGE_CONFIGS,
  TOTAL_BUDGET,
  PERIODS_PER_STAGE,
  TOTAL_PERIODS,
} from '@/lib/auction-engine'
import type { StageConfig } from '@/lib/auction-engine'

describe('Auction Engine Constants', () => {
  it('should have 3 stage configurations', () => {
    expect(STAGE_CONFIGS).toHaveLength(3)
  })

  it('should define correct stage multipliers', () => {
    expect(STAGE_CONFIGS[0].multiplier).toBe(1.0)
    expect(STAGE_CONFIGS[1].multiplier).toBe(1.5)
    expect(STAGE_CONFIGS[2].multiplier).toBe(3.0)
  })

  it('should have correct floor prices per stage', () => {
    expect(STAGE_CONFIGS[0].floorPrice).toBe(10)
    expect(STAGE_CONFIGS[1].floorPrice).toBe(15)
    expect(STAGE_CONFIGS[2].floorPrice).toBe(28)
  })

  it('should have correct tokens per period per stage', () => {
    expect(STAGE_CONFIGS[0].tokensPerPeriod).toBe(120)
    expect(STAGE_CONFIGS[1].tokensPerPeriod).toBe(80)
    expect(STAGE_CONFIGS[2].tokensPerPeriod).toBe(40)
  })

  it('should have 5 periods per stage', () => {
    expect(PERIODS_PER_STAGE).toBe(5)
  })

  it('should have 15 total periods (3 stages × 5 periods)', () => {
    expect(TOTAL_PERIODS).toBe(15)
  })

  it('should have total budget of 10000', () => {
    expect(TOTAL_BUDGET).toBe(10000)
  })
})

describe('resolvePeriod', () => {
  let stageConfig: StageConfig
  let tokensHeld: Map<string, number>
  let pendingRescinds: Map<string, { period: number; tokens: number; taxTokens: number }[]>
  let paidThisStage: Map<string, number>

  beforeEach(() => {
    stageConfig = STAGE_CONFIGS[0]
    tokensHeld = new Map([
      ['bot1', 0],
      ['bot2', 0],
      ['bot3', 0],
    ])
    pendingRescinds = new Map()
    paidThisStage = new Map([
      ['bot1', 0],
      ['bot2', 0],
      ['bot3', 0],
    ])
  })

  it('should resolve a single valid bid (solo winner pays floor)', () => {
    const bids = new Map([['bot1', 15]])

    const result = resolvePeriod(stageConfig, 0, 0, bids, tokensHeld, pendingRescinds, paidThisStage)

    expect(result.winnerBotId).toBe('bot1')
    expect(result.clearingPrice).toBe(stageConfig.floorPrice) // solo pays floor
    expect(result.tokensAvailable).toBe(stageConfig.tokensPerPeriod)
    expect(result.allocations).toHaveLength(1)
    expect(result.allocations[0].tokensWon).toBe(120)
  })

  it('should resolve two competing bids with second-highest as clearing price', () => {
    const bids = new Map([
      ['bot1', 20],
      ['bot2', 15],
    ])

    const result = resolvePeriod(stageConfig, 0, 0, bids, tokensHeld, pendingRescinds, paidThisStage)

    expect(result.winnerBotId).toBe('bot1')
    expect(result.clearingPrice).toBe(15) // second-highest = clearing price
    expect(result.numBidders).toBe(2)
  })

  it('should resolve multiple competing bids correctly', () => {
    const bids = new Map([
      ['bot1', 25],
      ['bot2', 18],
      ['bot3', 12],
    ])

    const result = resolvePeriod(stageConfig, 0, 0, bids, tokensHeld, pendingRescinds, paidThisStage)

    expect(result.winnerBotId).toBe('bot1')
    expect(result.clearingPrice).toBe(18) // second-highest
    expect(result.numBidders).toBe(3)
  })

  it('should handle no valid bids (all below floor)', () => {
    const bids = new Map([
      ['bot1', 5], // below floor (10)
      ['bot2', 8], // below floor
    ])

    const result = resolvePeriod(stageConfig, 0, 0, bids, tokensHeld, pendingRescinds, paidThisStage)

    expect(result.winnerBotId).toBeNull()
    expect(result.clearingPrice).toBe(stageConfig.floorPrice)
    expect(result.allocations).toHaveLength(0)
  })

  it('should handle bids exactly at floor price', () => {
    const bids = new Map([
      ['bot1', 10], // exactly floor
      ['bot2', 10],
    ])

    const result = resolvePeriod(stageConfig, 0, 0, bids, tokensHeld, pendingRescinds, paidThisStage)

    expect(result.winnerBotId).toBe('bot1')
    expect(result.clearingPrice).toBe(10) // floor price
    expect(result.numBidders).toBe(2)
  })

  it('should update tokens held for winner', () => {
    const bids = new Map([['bot1', 15]])

    const result = resolvePeriod(stageConfig, 0, 0, bids, tokensHeld, pendingRescinds, paidThisStage)

    expect(tokensHeld.get('bot1')).toBe(120)
    expect(paidThisStage.get('bot1')).toBe(1200) // 10 * 120
  })

  it('should track stage and period correctly', () => {
    const bids = new Map([['bot1', 15]])

    const result = resolvePeriod(stageConfig, 2, 7, bids, tokensHeld, pendingRescinds, paidThisStage)

    expect(result.stage).toBe(0)
    expect(result.period).toBe(2)
    expect(result.absolutePeriod).toBe(7)
  })

  it('should include all bots in allBids, even non-bidders', () => {
    const bids = new Map([['bot1', 15]])

    const result = resolvePeriod(stageConfig, 0, 0, bids, tokensHeld, pendingRescinds, paidThisStage)

    expect(result.allBids).toHaveLength(3)
    expect(result.allBids.find(b => b.botId === 'bot1')?.bid).toBe(15)
    expect(result.allBids.find(b => b.botId === 'bot2')?.bid).toBeNull()
    expect(result.allBids.find(b => b.botId === 'bot3')?.bid).toBeNull()
  })

  it('should calculate correct total cost for winner', () => {
    const bids = new Map([
      ['bot1', 20],
      ['bot2', 15],
    ])

    const result = resolvePeriod(stageConfig, 0, 0, bids, tokensHeld, pendingRescinds, paidThisStage)

    const winnerAlloc = result.allocations.find(a => a.botId === 'bot1')
    expect(winnerAlloc?.totalPaid).toBe(1800) // 15 * 120
    expect(winnerAlloc?.pricePaidPerToken).toBe(15)
  })
})

describe('calculateWeightedPoints', () => {
  it('should calculate weighted points correctly', () => {
    const tokensPerStage = new Map<string, [number, number, number]>([
      ['bot1', [120, 80, 40]], // S1: 120, S2: 80, S3: 40
      ['bot2', [60, 40, 20]],
    ])

    const wp = calculateWeightedPoints(tokensPerStage)

    // bot1: 120*1.0 + 80*1.5 + 40*3.0 = 120 + 120 + 120 = 360
    expect(wp.get('bot1')).toBe(360)
    // bot2: 60*1.0 + 40*1.5 + 20*3.0 = 60 + 60 + 60 = 180
    expect(wp.get('bot2')).toBe(180)
  })

  it('should handle zero tokens', () => {
    const tokensPerStage = new Map<string, [number, number, number]>([
      ['bot1', [0, 0, 0]],
    ])

    const wp = calculateWeightedPoints(tokensPerStage)

    expect(wp.get('bot1')).toBe(0)
  })
})

describe('canRescind', () => {
  it('should allow rescind in early periods', () => {
    const result = canRescind('bot1', 100, [], 0, 2)
    expect(result.allowed).toBe(true)
  })

  it('should forbid rescind in S3P4 and S3P5', () => {
    const result1 = canRescind('bot1', 100, [], 2, 4)
    expect(result1.allowed).toBe(false)
    expect(result1.reason).toContain('S3P4')

    const result2 = canRescind('bot1', 100, [], 2, 5)
    expect(result2.allowed).toBe(false)
    expect(result2.reason).toContain('S3P5')
  })

  it('should allow rescind in S3P3 and earlier', () => {
    const result = canRescind('bot1', 100, [], 2, 3)
    expect(result.allowed).toBe(true)
  })

  it('should require sufficient tokens for tax', () => {
    const result = canRescind('bot1', 1, [], 0, 0)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Insufficient tokens')
  })
})

describe('generateTurnId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateTurnId()
    const id2 = generateTurnId()
    expect(id1).not.toBe(id2)
  })

  it('should include timestamp', () => {
    const before = Date.now()
    const id = generateTurnId()
    const after = Date.now()

    const timestamp = parseInt(id.split('-')[0])
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })
})
