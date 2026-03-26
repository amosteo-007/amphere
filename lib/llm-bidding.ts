/**
 * LLM Bidding — calls LLM APIs to generate bid decisions for tournament opponents.
 *
 * Each opponent has a provider + model config stored in Bot.apiKey as:
 *   algo-<provider>-<model>-<tournamentId>
 *
 * Supported providers: anthropic, openai, groq
 *
 * Prompt is loaded from llm-bid-prompt.md with runtime game context injected.
 */

import { STAGE_CONFIGS, type StageConfig } from './auction-engine'
import { readFileSync } from 'fs'
import { join } from 'path'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY

export interface LLMOpponentConfig {
  provider: 'anthropic' | 'openai' | 'groq'
  model: string
}

export interface BidContext {
  stage: number
  period: number
  floorPrice: number
  tokensAvailable: number
  remainingBudget: number
  tokensHeld: number
  weightedPoints: number
  leaderboard: {
    botId: string
    botSlot: string
    tokensPerStage: number[]
    weightedPoints: number
  }[]
  history: {
    stage: number
    period: number
    allBids: { botId: string; bid: number | null }[]
    clearingPrice: number
    winnerBotId: string | null
  }[]
  // For rescind decisions
  justWon?: boolean
  rescindAvailable?: boolean
}

/**
 * Get the LLM bid for an opponent bot.
 * Returns a bid price (number), or null if the bot should skip.
 */
export async function getLLMBid(
  opponentApiKey: string,
  context: BidContext
): Promise<number | null> {
  const parts = opponentApiKey.split('-')
  // Format: algo-<provider>-<model>-<tournamentId>
  if (parts.length < 4) return null

  const provider = parts[1] as 'anthropic' | 'openai' | 'groq'
  const model = parts.slice(2, -1).join('-') // everything between provider and tournamentId
  const stageConfig = STAGE_CONFIGS[context.stage]

  const prompt = buildBidPrompt(context, stageConfig)

  switch (provider) {
    case 'anthropic':
      return getAnthropicBid(model, prompt, stageConfig)
    case 'openai':
      return getOpenAIBid(model, prompt, stageConfig)
    case 'groq':
      return getGroqBid(model, prompt, stageConfig)
    default:
      return null
  }
}

/**
 * Load the base prompt from the markdown file.
 * The base prompt contains all game rules, strategy, and format instructions.
 * Runtime game state is injected at the end.
 */
function loadBasePrompt(): string {
  try {
    return readFileSync(join(process.cwd(), 'lib', 'llm-bid-prompt.md'), 'utf-8')
  } catch {
    // Fallback inline prompt if file not found
    return `You are a competitive bidding agent. Output ONLY JSON: {"bid": <number|null>}. Bid is price per token.`
  }
}

function buildBidPrompt(context: BidContext, stageConfig: StageConfig): string {
  const base = loadBasePrompt()

  const leaderboardText = context.leaderboard
    .map(l => `  - ${l.botSlot}: ${l.tokensPerStage[context.stage]} tokens this stage, ${l.weightedPoints.toFixed(1)} weighted pts, SP=${l.weightedPoints > 0 ? 'has SP' : 'no SP yet'}`)
    .join('\n')

  const historyText = context.history.length === 0
    ? '  No previous periods.'
    : context.history
        .slice(-5)
        .map(h => `  S${h.stage+1}P${h.period+1}: clearing=${h.clearingPrice}, winner=${h.winnerBotId ?? 'none'}, bids=[${h.allBids.map(b => b.bid ?? 'skip').join(', ')}]`)
        .join('\n')

  // Compute derived game state
  const spGap = computeSPGap(context)
  const spendableNow = computeSpendableNow(context)

  let runtimeContext = `
---

## YOUR CURRENT STATE

**This period:** Stage ${context.stage + 1} of 3, Period ${context.period + 1} of 5
- Tokens available this period: ${context.tokensAvailable}
- Floor price: $${context.floorPrice.toFixed(2)}
- Your tokens held: ${context.tokensHeld}
- Your remaining budget: $${context.remainingBudget.toLocaleString()}
- Your weighted points: ${context.weightedPoints.toFixed(1)}

**SP gap analysis:** ${spGap}

**Spendable now (reserving ${context.tokensAvailable * context.floorPrice * 3} for S3):** $${spendableNow.toLocaleString()}

**Leaderboard (tokens this stage + weighted points):**
${leaderboardText}

**Recent auction history:**
${historyText}`

  if (context.justWon !== undefined) {
    const tokenCost = context.tokensAvailable * context.floorPrice
    const taxTokens = Math.ceil(context.tokensAvailable * 0.1)
    runtimeContext += `

**RESIND DECISION REQUIRED:**
- You just won ${context.tokensAvailable} tokens for $${tokenCost.toLocaleString()}
- Rescind tax if you rescind: ${taxTokens} tokens (deducted 2 periods from now)
- Rescind is ${context.rescindAvailable ? 'AVAILABLE' : 'FORBIDDEN'}${context.rescindAvailable === false && context.stage === 2 && context.period >= 3 ? ' (S3P4/P5 forbidden)' : ''}
- If you rescind: you get the payment back but lose ${taxTokens} tokens at reveal
- If you keep: you keep all tokens but payment is not refunded`
  }

  runtimeContext += `\n\nRespond with ONLY a JSON object. No explanation.`

  // Append runtime context to the base prompt
  // The base prompt ends with "## Your Decision" — inject runtime context before that
  const injectionPoint = base.lastIndexOf('## Your Decision')
  if (injectionPoint === -1) {
    return base + runtimeContext
  }
  return base.slice(0, injectionPoint) + runtimeContext + '\n\n' + base.slice(injectionPoint)
}

function computeSPGap(ctx: BidContext): string {
  const mySP = ctx.weightedPoints > 0 ? 1 : 0
  const leader = ctx.leaderboard.reduce((best, b) =>
    b.weightedPoints > best.weightedPoints ? b : best, ctx.leaderboard[0])
  const leaderSP = leader ? 1 : 0
  const gap = leaderSP - mySP

  if (gap <= 0) return 'You are leading in SP.'
  if (gap === 1) return `${gap} SP behind leader. This period matters.`
  return `${gap} SP behind. Critical to win this period.`
}

function computeSpendableNow(ctx: BidContext): number {
  // Reserve enough for all S3 wins at floor
  const s3Reserves = ctx.tokensAvailable * ctx.floorPrice * 3
  return Math.max(0, ctx.remainingBudget - s3Reserves)
}

async function getAnthropicBid(model: string, prompt: string, stageConfig: StageConfig): Promise<number | null> {
  if (!ANTHROPIC_KEY) {
    console.warn('[llm] ANTHROPIC_API_KEY not set — using fallback')
    return fallbackBid(stageConfig)
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      console.error('[llm] Anthropic error:', await res.text())
      return fallbackBid(stageConfig)
    }

    const data = await res.json() as { content: { text: string }[] }
    return parseBidResponse(data.content[0]?.text ?? '', stageConfig)
  } catch (err) {
    console.error('[llm] Anthropic fetch error:', err)
    return fallbackBid(stageConfig)
  }
}

async function getOpenAIBid(model: string, prompt: string, stageConfig: StageConfig): Promise<number | null> {
  if (!OPENAI_KEY) {
    console.warn('[llm] OPENAI_API_KEY not set — using fallback')
    return fallbackBid(stageConfig)
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256,
        temperature: 0.3,
      }),
    })

    if (!res.ok) {
      console.error('[llm] OpenAI error:', await res.text())
      return fallbackBid(stageConfig)
    }

    const data = await res.json() as { choices: { message: { content: string } }[] }
    return parseBidResponse(data.choices[0]?.message?.content ?? '', stageConfig)
  } catch (err) {
    console.error('[llm] OpenAI fetch error:', err)
    return fallbackBid(stageConfig)
  }
}

async function getGroqBid(model: string, prompt: string, stageConfig: StageConfig): Promise<number | null> {
  if (!GROQ_KEY) {
    console.warn('[llm] GROQ_API_KEY not set — using fallback')
    return fallbackBid(stageConfig)
  }

  try {
    const res = await fetch('https://api.groq.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256,
        temperature: 0.3,
      }),
    })

    if (!res.ok) {
      console.error('[llm] Groq error:', await res.text())
      return fallbackBid(stageConfig)
    }

    const data = await res.json() as { choices: { message: { content: string } }[] }
    return parseBidResponse(data.choices[0]?.message?.content ?? '', stageConfig)
  } catch (err) {
    console.error('[llm] Groq fetch error:', err)
    return fallbackBid(stageConfig)
  }
}

function parseBidResponse(text: string, stageConfig: StageConfig): number | null {
  try {
    // Extract JSON from response
    const match = text.match(/\{[\s\S]*?\}/)
    if (!match) return fallbackBid(stageConfig)
    const parsed = JSON.parse(match[0]) as { bid: number | null }
    if (typeof parsed.bid === 'number' && parsed.bid >= stageConfig.floorPrice) {
      return parsed.bid
    }
    return null // skip
  } catch {
    return fallbackBid(stageConfig)
  }
}

/**
 * Fallback: simple probabilistic bid when no API key is available.
 * 70% chance: bid just above floor. 30% chance: moderate aggression.
 */
function fallbackBid(stageConfig: StageConfig): number | null {
  const floor = stageConfig.floorPrice
  const rand = Math.random()
  if (rand < 0.15) return null // skip
  if (rand < 0.85) return floor * (1 + Math.random() * 0.1) // 70%: just above floor
  return floor * (1.2 + Math.random() * 0.5) // 15%: moderately aggressive
}
