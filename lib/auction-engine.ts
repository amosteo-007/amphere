/**
 * Aurasct Auction Engine
 *
 * Implements the Vickrey multi-stage token auction tournament logic.
 * Each period is a sealed-bid second-price (Vickrey) auction.
 * 3 stages × 5 periods = 15 total auctions.
 */

export interface StageConfig {
  stageNumber: number
  floorPrice: number
  tokensPerPeriod: number
  multiplier: number
}

export interface BidSubmission {
  botId: string
  pricePerToken: number
  type: 'bid' | 'rescind' | 'skip'
}

export interface PeriodResult {
  stage: number
  period: number
  absolutePeriod: number
  clearingPrice: number
  winnerBotId: string | null
  tokensAvailable: number
  numBidders: number
  allBids: { botId: string; bid: number | null }[]
  allocations: {
    botId: string
    tokensWon: number
    totalPaid: number
    pricePaidPerToken: number
  }[]
  rescindDetail: {
    botId: string
    tokensReturned: number
    taxTokens: number
  } | null
}

export interface TurnInfo {
  turnId: string
  botId: string
  decisionType: 'bid' | 'rescind'
  stage: number
  period: number
  expiresAt: string
  observation: {
    sp: number
    stage: number
    period: number
    floorPrice: number
    tokensAvailable: number
    remainingBudget: number
    weightedPoints: number
    pointsPerToken: number
    periodsInStage: number
    stagesRemaining: number
    tokensPerStage: number[]
    leaderboard: {
      botId: string
      tokensPerStage: number[]
      weightedPoints: number
      sp: number
    }[]
    history: {
      stage: number
      period: number
      allBids: { botId: string; bid: number | null }[]
      winnerBotId: string
      clearingPrice: number
      allocations: { botId: string; tokensWon: number; totalPaid: number }[]
    }[]
    privateRescindInfo: {
      pendingRescinds: { period: number; tokens: number; taxTokens: number }[]
    }[]
    canAffordRescindTax: boolean
  }
  winResult: {
    stage: number
    period: number
    allBids: { botId: string; bid: number | null }[]
    allocations: {
      botId: string
      tokensWon: number
      totalPaid: number
      pricePaidPerToken: number
    }[]
    numBidders: number
    winnerBotId: string
    clearingPrice: number
  } | null
}

export const STAGE_CONFIGS: StageConfig[] = [
  { stageNumber: 0, floorPrice: 10, tokensPerPeriod: 120, multiplier: 1.0 },
  { stageNumber: 1, floorPrice: 15, tokensPerPeriod: 80, multiplier: 1.5 },
  { stageNumber: 2, floorPrice: 28, tokensPerPeriod: 40, multiplier: 3.0 },
]

export const TOTAL_BUDGET = 10_000
export const PERIODS_PER_STAGE = 5
export const TOTAL_PERIODS = PERIODS_PER_STAGE * STAGE_CONFIGS.length

/**
 * Process a single period's auction.
 * Takes all bids for the period, determines the winner via Vickrey,
 * applies rescind mechanics, and calculates the clearing price.
 */
export function resolvePeriod(
  stageConfig: StageConfig,
  period: number,
  absolutePeriod: number,
  bids: Map<string, number>, // botId -> bid price
  tokensHeld: Map<string, number>, // botId -> current tokens held
  pendingRescinds: Map<string, { period: number; tokens: number; taxTokens: number }[]>, // botId -> pending rescinds
  paidThisStage: Map<string, number> // botId -> total paid this stage
): PeriodResult {
  const { floorPrice, tokensPerPeriod } = stageConfig
  const entries = Array.from(bids.entries())

  // Filter valid bids (at or above floor)
  const validBids = entries
    .filter(([_, price]) => price >= floorPrice)
    .sort((a, b) => b[1] - a[1]) // descending

  const numBidders = validBids.length

  // Solo winner pays floor
  // Multiple bidders: highest wins, pays second-highest
  let winnerBotId: string | null = null
  let clearingPrice = floorPrice

  if (validBids.length === 0) {
    // No valid bids — no winner, no allocation
    winnerBotId = null
    clearingPrice = floorPrice
  } else if (validBids.length === 1) {
    winnerBotId = validBids[0][0]
    clearingPrice = floorPrice // solo pays floor
  } else {
    winnerBotId = validBids[0][0]
    clearingPrice = validBids[1][1] // second-highest = clearing price
  }

  const totalCost = clearingPrice * tokensPerPeriod

  // Build all bids record (including null for non-bidders)
  const allBids: { botId: string; bid: number | null }[] = entries.map(([botId, bid]) => ({ botId, bid }))
  // Add non-bidders
  const biddingBotIds = new Set(entries.map(([id]) => id))
  const allParticipatingBotIds = Array.from(tokensHeld.keys())
  for (const botId of allParticipatingBotIds) {
    if (!biddingBotIds.has(botId)) {
      allBids.push({ botId, bid: null })
    }
  }

  const allocations: PeriodResult['allocations'] = []

  // Process winner payment and token allocation
  if (winnerBotId) {
    const winnerHeld = tokensHeld.get(winnerBotId) ?? 0
    // Check if winner can afford
    const winnerPaidThisStage = paidThisStage.get(winnerBotId) ?? 0
    // Budget check: in the real game, this is per-bot. For simplicity we trust the client.
    allocations.push({
      botId: winnerBotId,
      tokensWon: tokensPerPeriod,
      totalPaid: totalCost,
      pricePaidPerToken: clearingPrice,
    })
    // Update tokens held
    tokensHeld.set(winnerBotId, winnerHeld + tokensPerPeriod)
    // Update stage spend
    paidThisStage.set(winnerBotId, winnerPaidThisStage + totalCost)
  }

  // Process pending rescinds (2-period reveal delay)
  const revealedRescinds: PeriodResult['rescindDetail'][] = []
  for (const [botId, rescinds] of pendingRescinds.entries()) {
    const stillPending = rescinds.filter(r => r.period > period)
    pendingRescinds.set(botId, stillPending)
  }

  // Resolve phantom holdings for next period
  // Note: phantom tracking is handled at the tournament level

  return {
    stage: stageConfig.stageNumber,
    period,
    absolutePeriod,
    clearingPrice,
    winnerBotId,
    tokensAvailable: tokensPerPeriod,
    numBidders,
    allBids,
    allocations,
    rescindDetail: revealedRescinds.length > 0 ? revealedRescinds[0] : null,
  }
}

/**
 * Calculate SP awards after a stage completes.
 */
export function calculateStageSPRewards(
  tokensPerStage: Map<string, [number, number, number]>, // botId -> [S1tokens, S2tokens, S3tokens]
  stage: number,
  stageConfig: StageConfig
): Map<string, { rank: number; sp: number }> {
  // Get token counts for this stage
  const stageTokens = Array.from(tokensPerStage.entries())
    .map(([botId, tokens]) => ({ botId, tokens: tokens[stage] }))
    .sort((a, b) => b.tokens - a.tokens) // descending

  const rewards: Map<string, { rank: number; sp: number }> = new Map()
  const rankSp = [3, 2, 1] // 1st=3, 2nd=2, 3rd=1

  for (let i = 0; i < stageTokens.length; i++) {
    const { botId, tokens } = stageTokens[i]
    if (tokens === 0 && i > 0) {
      // 0 tokens — no SP (but carryforward may apply)
      continue
    }
    const rank = i + 1
    if (rank <= 3) {
      rewards.set(botId, { rank, sp: rankSp[rank - 1] })
    }
  }

  return rewards
}

/**
 * Calculate weighted points for bonus SP.
 */
export function calculateWeightedPoints(
  tokensPerStage: Map<string, [number, number, number]>
): Map<string, number> {
  const wp = new Map<string, number>()

  for (const [botId, tokens] of tokensPerStage.entries()) {
    const [s1, s2, s3] = tokens
    const total =
      s1 * STAGE_CONFIGS[0].multiplier +
      s2 * STAGE_CONFIGS[1].multiplier +
      s3 * STAGE_CONFIGS[2].multiplier
    wp.set(botId, total)
  }

  return wp
}

/**
 * Check if rescind is legal for a given bot and period.
 */
export function canRescind(
  botId: string,
  tokensHeld: number,
  pendingRescinds: { period: number; tokens: number; taxTokens: number }[],
  stage: number,
  period: number
): { allowed: boolean; reason?: string } {
  // Forbidden in S3P4 and S3P5
  if (stage === 2 && period >= 4) {
    return { allowed: false, reason: 'Rescind forbidden in S3P4 and S3P5' }
  }

  // Must have enough tokens for tax
  const taxTokens = Math.ceil(40 * 0.1) // rough estimate, actual varies by tokens
  if (tokensHeld < taxTokens) {
    return { allowed: false, reason: `Insufficient tokens for rescind tax (need ${taxTokens})` }
  }

  return { allowed: true }
}

/**
 * Generate a unique turn ID.
 */
export function generateTurnId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
