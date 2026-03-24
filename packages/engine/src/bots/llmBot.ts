import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname shim.
// tsx running under "type":"module" does NOT inject __dirname, unlike CommonJS.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded before reading keys
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(process.cwd(), '.env') });
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
} catch {}

import {
  BotAgent,
  BotObservation,
  BotBidDecision,
  BotRescindDecision,
  PeriodResult,
} from '../models/types.js';
import { getPersona, DEFAULT_PERSONA } from './personas.js';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type LLMProvider = 'groq' | 'anthropic' | 'openai' | 'google' | 'deepseek' | 'kimi'| 'mistral';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface LLMBotOptions {
  bot_id: string;
  provider: LLMProvider;
  model?: string;
  persona?: string;
  /** Raw persona prompt text. When set, overrides the named persona lookup. */
  personaPrompt?: string;
  /** Memory context from previous tournaments — injected between persona and JSON instruction. */
  memoryContext?: string;
  apiKey?: string;
  maxHistoryExchanges?: number;
  timeoutMs?: number;
  saveLogs?: boolean;
  logDir?: string;
  /** Skip extended thinking/reasoning for faster inference in single-player mode. */
  disableThinking?: boolean;
}

export interface LLMLogEntry {
  period: number;
  stage: number;
  type: 'bid' | 'rescind';
  observation_summary: string;
  prompt: string;
  thinking?: string;
  raw_response: string;
  parsed_decision: any;
  latency_ms: number;
  error?: string;
}

interface APIResult {
  text: string;
  thinking?: string;
  googleParts?: any[]; // full parts array including thought blocks with signatures
}

// ─── Default Models ─────────────────────────────────────────────────────────────

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  groq: 'llama-3.3-70b-versatile',
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-5.4-mini',
  google: 'gemini-3.1-flash-lite-preview',
  mistral: 'magistral-small-latest',
  deepseek: 'deepseek-reasoner',
  kimi:'kimi-k2-thinking',
  // 'claude-code': '', // uses whatever model Claude Code is configured with
};

const ENV_KEY_NAMES: Record<LLMProvider, string> = {
  groq: 'GROQ_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  kimi: 'MOONSHOT_API_KEY',
  // 'claude-code': '', // no API key needed — uses local claude CLI + subscription
};

// NVIDIA queues requests (free tier); allow up to 5 minutes
const DEFAULT_TIMEOUTS: Record<LLMProvider, number> = {
  groq: 30000,
  anthropic: 60000,
  openai: 60000,
  google: 60000,
  deepseek: 200000,
  mistral: 200000,
  kimi: 200000,
};

const DEFAULT_MAX_TOKENS: Record<LLMProvider, number> = {
  groq: 16384, // reasoning model (gpt-oss-120b) — needs room for chain-of-thought + content
  anthropic: 300,
  openai: 3000,
  google: 2400, // gemini-3-flash-preview has thinking — needs room for chain-of-thought
  mistral: 8192,
  deepseek: 8000,
  kimi:8000,
};

// ─── LLM Bot Implementation ────────────────────────────────────────────────────

export class LLMBot implements BotAgent {
  readonly bot_id: string;
  private provider: LLMProvider;
  private model: string;
  private apiKey: string;
  private systemPrompt: string;
  private conversationHistory: ConversationMessage[] = [];
  // Google-native conversation history that preserves thought_signature blocks for multi-turn
  private googleContents: Array<{ role: 'user' | 'model'; parts: any[] }> = [];
  private maxHistory: number;
  private timeoutMs: number;
  private saveLogs: boolean;
  private logDir: string;
  private disableThinking: boolean;
  private logs: LLMLogEntry[] = [];

  constructor(options: LLMBotOptions) {
    this.bot_id = options.bot_id;
    this.provider = options.provider;
    this.model = options.model ?? DEFAULT_MODELS[options.provider];
    const PROVIDER_MAX_HISTORY: Partial<Record<LLMProvider, number>> = {
      anthropic: 6,  // extended thinking is expensive — keep history short
      google: 8,
      groq: 8,      // 16K output budget, can carry more history
      deepseek: 8,
      openai: 8,
      kimi: 8,
      mistral:8,
    };
    this.maxHistory = options.maxHistoryExchanges ?? PROVIDER_MAX_HISTORY[options.provider] ?? 8;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUTS[options.provider];
    this.saveLogs = options.saveLogs ?? false;
    this.logDir = options.logDir ?? '.';
    this.disableThinking = options.disableThinking ?? false;

    // Resolve API key (claude-code uses local CLI — no key needed)
    const envKeyName = ENV_KEY_NAMES[options.provider];
    if (envKeyName) {
      this.apiKey = (options.apiKey ?? process.env[envKeyName] ?? '').trim().replace(/^["']|["']$/g, '');
      if (!this.apiKey) {
        throw new Error(
          `No API key for ${options.provider}. Set ${envKeyName} in your .env file.\n` +
          `  ${envKeyName}=your-key-here`,
        );
      }
    } else {
      this.apiKey = '';
    }

    // Build system prompt: base context + persona
    // personaPrompt (raw text) takes priority over a named persona lookup.
    const baseContext = this.loadBaseContext();
    const persona = options.personaPrompt?.trim() || getPersona(options.persona ?? DEFAULT_PERSONA);

    const promptParts = [baseContext, persona];
    if (options.memoryContext?.trim()) {
      promptParts.push(`## Your Strategic Memory (from previous tournaments)\n\n${options.memoryContext.trim()}`);
    }
    promptParts.push(
      'CRITICAL: Always respond with ONLY valid JSON. No markdown, no explanation, no code fences, no extra text.\n' +
      'For bids: {"price_per_token": <number>} or {"skip": true}\n' +
      'For rescind: {"rescind": true} or {"rescind": false}',
    );
    this.systemPrompt = promptParts.join('\n\n');
  }

  // ─── BotAgent Interface ───────────────────────────────────────────────

  async decideBids(obs: BotObservation): Promise<BotBidDecision> {
    const prompt = this.formatBidPrompt(obs);
    const start = Date.now();

    let rawResponse = '';
    let thinking: string | undefined;
    let parsed: any = null;
    let error: string | undefined;

    try {
      const result = this.callAPI(prompt);
      rawResponse = result.text;
      thinking = result.thinking;
      parsed = this.parseJSON(rawResponse);

      if (parsed.skip === true) {
        this.recordLog(obs, 'bid', prompt, rawResponse, { bids: [] }, Date.now() - start, undefined, thinking);
        return { bids: [] };
      }

      if (typeof parsed.price_per_token === 'number') {
        const price = parsed.price_per_token;

        if (price < obs.floor_price) {
          error = `Bid $${price.toFixed(2)} below floor $${obs.floor_price.toFixed(2)}`;
          this.recordLog(obs, 'bid', prompt, rawResponse, { bids: [] }, Date.now() - start, error, thinking);
          console.error(`  ⚠️  ${this.bot_id}: ${error}`);
          return { bids: [] };
        }

        if (price * obs.tokens_available > obs.remaining_budget) {
          error = `Bid $${price.toFixed(2)} × ${obs.tokens_available} = $${(price * obs.tokens_available).toFixed(2)} exceeds budget $${obs.remaining_budget.toFixed(2)}`;
          this.recordLog(obs, 'bid', prompt, rawResponse, { bids: [] }, Date.now() - start, error, thinking);
          console.error(`  ⚠️  ${this.bot_id}: ${error}`);
          return { bids: [] };
        }

        const decision = { bids: [{ price_per_token: price }] };
        this.recordLog(obs, 'bid', prompt, rawResponse, decision, Date.now() - start, undefined, thinking);
        return decision;
      }

      error = `Unexpected response format: ${rawResponse.slice(0, 300)}`;
    } catch (e: any) {
      error = e.message;
    }

    if (error) {
      console.error(`  ⚠️  ${this.bot_id} bid error: ${error}`);
    }
    this.recordLog(obs, 'bid', prompt, rawResponse, { bids: [] }, Date.now() - start, error, thinking);
    return { bids: [] };
  }

  async decideRescind(obs: BotObservation, winResult: PeriodResult): Promise<BotRescindDecision> {
    const prompt = this.formatRescindPrompt(obs, winResult);
    const start = Date.now();

    let rawResponse = '';
    let thinking: string | undefined;
    let parsed: any = null;
    let error: string | undefined;

    try {
      const result = this.callAPI(prompt);
      rawResponse = result.text;
      thinking = result.thinking;
      parsed = this.parseJSON(rawResponse);

      if (typeof parsed.rescind === 'boolean') {
        const decision = { rescind: parsed.rescind };
        this.recordLog(obs, 'rescind', prompt, rawResponse, decision, Date.now() - start, undefined, thinking);
        return decision;
      }

      error = `Unexpected rescind response: ${rawResponse.slice(0, 300)}`;
    } catch (e: any) {
      error = e.message;
    }

    if (error) {
      console.error(`  ⚠️  ${this.bot_id} rescind error: ${error}`);
    }
    this.recordLog(obs, 'rescind', prompt, rawResponse, { rescind: false }, Date.now() - start, error, thinking);
    return { rescind: false };
  }

  // ─── Prompt Formatting ────────────────────────────────────────────────

  private formatBidPrompt(obs: BotObservation): string {
    const s = obs.stage + 1;
    const p = obs.period + 1;
    const maxBid = obs.tokens_available > 0 ? obs.remaining_budget / obs.tokens_available : 0;

    const sorted = [...obs.leaderboard].sort((a, b) => b.sp - a.sp || b.weighted_points - a.weighted_points);
    const ranks = sorted.map((e) => {
      const you = e.bot_id === this.bot_id ? '◀' : '';
      return `${e.bot_id}:${e.sp}SP/${e.weighted_points.toFixed(0)}pts[${e.tokens_per_stage.join(',')}]${you}`;
    }).join(' | ');

    const recent = obs.history.slice(-3);
    const prices = recent.map((h) => {
      const rs = h.rescinded === true ? 'R' : '';
      return `S${h.stage + 1}P${h.period + 1}:$${h.clearing_price.toFixed(1)}${rs}`;
    }).join(' ');

    let out = `S${s}P${p}/${obs.periods_in_stage} | Bgt $${obs.remaining_budget.toFixed(0)} | SP ${obs.sp} | Pts ${obs.weighted_points.toFixed(0)}\n`;
    out += `Period: ${obs.tokens_available.toFixed(0)}tok floor $${obs.floor_price.toFixed(2)} ${obs.points_per_token}×pts | MaxBid $${maxBid.toFixed(2)}/tok\n`;
    out += `Holdings: [${obs.tokens_per_stage.map((t, i) => `S${i + 1}:${t}`).join(' ')}]\n`;
    out += `Ranks: ${ranks}\n`;
    if (prices) out += `Prices(last 3): ${prices}\n`;

    if (obs.private_rescind_info.length > 0) {
      const info = obs.private_rescind_info.map((r) => `+${r.tokens}tok→S${r.target_stage + 1}P${r.target_period + 1}`).join(' ');
      out += `Private: ${info}\n`;
    }

    out += `\nBid decision (JSON only): {"price_per_token": <number>} or {"skip": true}`;
    return out;
  }

  private formatRescindPrompt(obs: BotObservation, winResult: PeriodResult): string {
    const alloc = winResult.allocations[0];
    const ratio = winResult.clearing_price / obs.floor_price;

    let p = `YOU WON! Tokens: ${alloc.tokens_won.toFixed(0)} | Price: $${winResult.clearing_price.toFixed(2)}/tok | Total: $${alloc.total_paid.toFixed(2)}\n`;
    p += `Price/floor: ${ratio.toFixed(2)}× | Budget now: $${obs.remaining_budget.toFixed(2)} | SP: ${obs.sp}\n`;
    p += `Tokens: [${obs.tokens_per_stage.join(',')}]\n\n`;
    p += `RESCIND = refund $${alloc.total_paid.toFixed(2)}, tokens re-enter in 2 periods (secret)\n`;
    p += `KEEP = hold for stage ranking\n\n`;
    p += `Your decision (JSON only): {"rescind": true} or {"rescind": false}`;
    return p;
  }

  // ─── API Call (Synchronous) ───────────────────────────────────────────

  private callAPI(userMessage: string): APIResult {
    this.conversationHistory.push({ role: 'user', content: userMessage });

    while (this.conversationHistory.length > this.maxHistory * 2) {
      this.conversationHistory.shift();
    }

    // Maintain Google-native history in parallel (needed for thought_signature passthrough)
    if (this.provider === 'google') {
      this.googleContents.push({ role: 'user', parts: [{ text: userMessage }] });
      while (this.googleContents.length > this.maxHistory * 2) {
        this.googleContents.shift();
      }
    }

    let result: APIResult;

    if (this.provider === 'anthropic') {
      result = this.callAnthropic();
    } else if (this.provider === 'google') {
      result = this.callGoogle();
    } else {
      // OpenAI-compatible REST API (groq, openai, nvidia)
      const urls: Record<string, string> = {
        groq: 'https://api.groq.com/openai/v1/chat/completions',
        openai: 'https://api.openai.com/v1/chat/completions',
        nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
        deepseek: 'https://api.deepseek.com/chat/completions',
        mistral: 'https://api.mistral.ai/v1/chat/completions',
        kimi: 'https://api.moonshot.ai/v1/chat/completions',
      };
      result = this.callOpenAICompatibleREST(
        urls[this.provider] ?? urls.openai,
        `Bearer ${this.apiKey}`,
      );
    }

    if (result.text) {
      this.conversationHistory.push({ role: 'assistant', content: result.text });
    }
    // Store full model parts (with thought_signature) for next Google turn
    if (this.provider === 'google' && result.googleParts) {
      this.googleContents.push({ role: 'model', parts: result.googleParts });
    }
    return result;
  }

  /**
   * Call any OpenAI-compatible REST API via curl.
   */
  private callOpenAICompatibleREST(url: string, authHeader: string): APIResult {
    // OpenAI gpt-5+ models require max_completion_tokens instead of max_tokens
    const useCompletionTokens = this.provider === 'openai';
    const tokenLimit = DEFAULT_MAX_TOKENS[this.provider];
    const body: Record<string, unknown> = {
      model: this.model,
      ...(useCompletionTokens ? { max_completion_tokens: tokenLimit } : { max_tokens: tokenLimit }),
      ...(this.provider === 'openai' ? {} : { temperature: 0.7 }),
      stream: false,
      messages: [
        { role: 'system', content: this.systemPrompt },
        ...this.conversationHistory,
      ],
    };

    // Enable chain-of-thought reasoning for Groq reasoning models only (skip if thinking disabled)
    if (!this.disableThinking && this.provider === 'groq' && this.model.includes('gpt-oss')) {
      body.reasoning_effort = 'high';
    }
    // // Enable thinking for NVIDIA deepseek models
    // if (this.provider === 'nvidia') {
    //   body.chat_template_kwargs = { thinking: true };
    // }

    const tmpFile = path.join(os.tmpdir(), `llm_req_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(body));

    try {
      const result = execSync(
        `curl -s --compressed "${url}" ` +
        `-H "Authorization: ${authHeader}" ` +
        `-H "Content-Type: application/json" ` +
        `-d @"${tmpFile}"`,
        { encoding: 'utf-8', timeout: this.timeoutMs, maxBuffer: 10 * 1024 * 1024 },
      );

      let parsed: any;
      try {
        parsed = JSON.parse(result);
      } catch (e: any) {
        throw new Error(`JSON parse failed (${e.message}). Raw response (first 500 chars): ${result.slice(0, 500)}`);
      }
      if (parsed.error) {
        throw new Error(`API error: ${JSON.stringify(parsed.error)}`);
      }
      const msg = parsed.choices?.[0]?.message;
      // Groq reasoning models return thinking in `reasoning` field (not `reasoning_content`)
      // Google Gemini thinking models may use `reasoning_content`
      const thinking = (msg?.reasoning ?? msg?.reasoning_content) as string | undefined;
      // content can be a string or an array of objects (e.g. Mistral, some providers)
      let text = msg?.content ?? '';
      if (typeof text !== 'string') {
        text = Array.isArray(text)
          ? text.map((c: any) => c.text ?? c.content ?? '').join('')
          : String(text);
      }
      return { text, thinking: thinking || undefined };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }

  /**
   * Call Anthropic (non-OpenAI-compatible format).
   */
  private callAnthropic(): APIResult {
    const thinkingBudget = 8000;
    const body: Record<string, unknown> = {
      model: this.model,
      system: this.systemPrompt,
      messages: this.conversationHistory,
    };

    if (this.disableThinking) {
      body.max_tokens = DEFAULT_MAX_TOKENS.anthropic;
    } else {
      // budget_tokens must be < max_tokens; 8000 budget + 500 for the JSON response
      body.max_tokens = thinkingBudget + 500;
      body.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
    }

    const tmpFile = path.join(os.tmpdir(), `llm_req_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(body));

    try {
      const betaHeader = this.disableThinking ? '' : `-H "anthropic-beta: interleaved-thinking-2025-05-14" `;
      const result = execSync(
        `curl -s https://api.anthropic.com/v1/messages ` +
        `-H "x-api-key: ${this.apiKey}" ` +
        `-H "anthropic-version: 2023-06-01" ` +
        betaHeader +
        `-H "Content-Type: application/json" ` +
        `-d @"${tmpFile}"`,
        { encoding: 'utf-8', timeout: this.timeoutMs },
      );

      const parsed = JSON.parse(result);
      if (parsed.error) {
        throw new Error(`Anthropic error: ${parsed.error.message}`);
      }
      const blocks: any[] = parsed.content ?? [];
      const thinkingBlocks = blocks
        .filter((b: any) => b.type === 'thinking')
        .map((b: any) => b.thinking as string)
        .join('\n\n');
      const textBlocks = blocks
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text as string)
        .join('');
      return { text: textBlocks, thinking: thinkingBlocks || undefined };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }

  /**
   * Call Google Gemini native API with thinking enabled (thinkingBudget=8192 = "medium").
   * Uses the native generateContent endpoint instead of the OpenAI-compatible shim
   * because thinkingConfig is not available on the OpenAI-compatible endpoint.
   */
  private callGoogle(): APIResult {
    // Use googleContents which preserves thought_signature blocks from previous turns.
    // Falls back to conversationHistory on first call (googleContents not yet populated).
    const contents = this.googleContents.length > 0
      ? this.googleContents
      : this.conversationHistory.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

    const body = {
      system_instruction: { parts: [{ text: this.systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: DEFAULT_MAX_TOKENS[this.provider],
        temperature: 0.7,
        ...(this.disableThinking ? {} : { thinkingConfig: { includeThoughts: true } }),
      },
    };

    const tmpFile = path.join(os.tmpdir(), `llm_req_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(body));

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const result = execSync(
        `curl -s "${url}" ` +
        `-H "Content-Type: application/json" ` +
        `-d @"${tmpFile}"`,
        { encoding: 'utf-8', timeout: this.timeoutMs, maxBuffer: 10 * 1024 * 1024 },
      );

      let parsed: any;
      try {
        parsed = JSON.parse(result);
      } catch (e: any) {
        throw new Error(`JSON parse failed (${e.message}). Raw: ${result.slice(0, 500)}`);
      }
      if (parsed.error) {
        throw new Error(`Google API error: ${parsed.error.message}`);
      }

      const parts: any[] = parsed.candidates?.[0]?.content?.parts ?? [];
      // Thinking parts have thought===true in Gemini's response
      const thinkingParts = parts.filter((p: any) => p.thought === true);
      const textParts = parts.filter((p: any) => p.thought !== true);
      if (thinkingParts.length === 0 && parts.length > 0) {
        console.warn(`[Google] No thinking parts returned. Parts: ${JSON.stringify(parts.map((p: any) => ({ thought: p.thought, keys: Object.keys(p) })))}`);
      }
      const thinkingText = thinkingParts.map((p: any) => p.text as string).join('\n\n');
      const responseText = textParts.map((p: any) => p.text as string).join('');

      return { text: responseText, thinking: thinkingText || undefined, googleParts: parts };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }

  // ─── One-shot Reflection Call ─────────────────────────────────────────

  /**
   * Make a one-shot LLM call for post-tournament reflection.
   * Does NOT use or modify conversation history. Returns raw text + token count.
   */
  async generateReflection(prompt: string): Promise<{ text: string; token_count: number }> {
    try {
      const systemPrompt = 'You are a strategic analyst reviewing your own performance in a competitive auction tournament. Respond with detailed, honest analysis.';
      return this.callReflectionProvider(systemPrompt, prompt);
    } catch (e: any) {
      console.error(`  ⚠️  ${this.bot_id} reflection error: ${e.message}`);
      return { text: '', token_count: 0 };
    }
  }

  private callReflectionProvider(systemPrompt: string, userMessage: string): { text: string; token_count: number } {
    const tmpFile = path.join(os.tmpdir(), `llm_reflect_${Date.now()}.json`);

    if (this.provider === 'anthropic') {
      const body = {
        model: this.model,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      };
      fs.writeFileSync(tmpFile, JSON.stringify(body));
      try {
        const result = execSync(
          `curl -s https://api.anthropic.com/v1/messages ` +
          `-H "x-api-key: ${this.apiKey}" ` +
          `-H "anthropic-version: 2023-06-01" ` +
          `-H "Content-Type: application/json" ` +
          `-d @"${tmpFile}"`,
          { encoding: 'utf-8', timeout: this.timeoutMs },
        );
        const parsed = JSON.parse(result);
        if (parsed.error) throw new Error(parsed.error.message);
        const text = (parsed.content ?? [])
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text as string)
          .join('');
        return { text, token_count: parsed.usage?.output_tokens ?? 0 };
      } finally {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    }

    if (this.provider === 'google') {
      const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
      };
      fs.writeFileSync(tmpFile, JSON.stringify(body));
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        const result = execSync(
          `curl -s "${url}" -H "Content-Type: application/json" -d @"${tmpFile}"`,
          { encoding: 'utf-8', timeout: this.timeoutMs, maxBuffer: 10 * 1024 * 1024 },
        );
        const parsed = JSON.parse(result);
        if (parsed.error) throw new Error(parsed.error.message);
        const text = (parsed.candidates?.[0]?.content?.parts ?? [])
          .filter((p: any) => p.thought !== true)
          .map((p: any) => p.text as string)
          .join('');
        return { text, token_count: parsed.usageMetadata?.candidatesTokenCount ?? 0 };
      } finally {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    }

    // OpenAI-compatible providers
    const urls: Record<string, string> = {
      groq: 'https://api.groq.com/openai/v1/chat/completions',
      openai: 'https://api.openai.com/v1/chat/completions',
      nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
      deepseek: 'https://api.deepseek.com/chat/completions',
      mistral: 'https://api.mistral.ai/v1/chat/completions',
      kimi: 'https://api.moonshot.ai/v1/chat/completions',
    };
    const body: Record<string, unknown> = {
      model: this.model,
      ...(this.provider === 'openai' ? { max_completion_tokens: 1000 } : { max_tokens: 1000 }),
      ...(this.provider === 'openai' ? {} : { temperature: 0.7 }),
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    };
    fs.writeFileSync(tmpFile, JSON.stringify(body));
    try {
      const url = urls[this.provider] ?? urls.openai;
      const result = execSync(
        `curl -s --compressed "${url}" ` +
        `-H "Authorization: Bearer ${this.apiKey}" ` +
        `-H "Content-Type: application/json" ` +
        `-d @"${tmpFile}"`,
        { encoding: 'utf-8', timeout: this.timeoutMs, maxBuffer: 10 * 1024 * 1024 },
      );
      const parsed = JSON.parse(result);
      if (parsed.error) throw new Error(JSON.stringify(parsed.error));
      const msg = parsed.choices?.[0]?.message;
      return { text: msg?.content ?? '', token_count: parsed.usage?.completion_tokens ?? 0 };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }

  // ─── Response Parsing ─────────────────────────────────────────────────

  private parseJSON(text: string): any {
    let cleaned = text.trim();
    // Strip markdown code fences
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // Find the first complete JSON object using brace counting (handles nested braces and strings)
    const start = cleaned.indexOf('{');
    if (start !== -1) {
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = start; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (!inString) {
          if (ch === '{') depth++;
          else if (ch === '}' && --depth === 0) {
            return JSON.parse(cleaned.slice(start, i + 1));
          }
        }
      }
    }
    return JSON.parse(cleaned);
  }

  // ─── Base Context ─────────────────────────────────────────────────────

  private loadBaseContext(): string {
    const candidates = [
      path.join(process.cwd(), 'LLM_AGENT_CONTEXT.md'),
      path.join(__dirname, '../../LLM_AGENT_CONTEXT.md'),
      path.join(__dirname, '../../../LLM_AGENT_CONTEXT.md'),
    ];
    for (const p of candidates) {
      try { return fs.readFileSync(p, 'utf-8'); } catch {}
    }
    return 'You are a bidding agent in a Vickrey auction tournament. Budget: $10,000. Respond with JSON only.';
  }

  // ─── Logging ──────────────────────────────────────────────────────────

  private recordLog(obs: BotObservation, type: 'bid' | 'rescind', prompt: string, rawResponse: string, decision: any, latencyMs: number, error?: string, thinking?: string): void {
    this.logs.push({
      period: obs.absolute_period, stage: obs.stage, type,
      observation_summary: `S${obs.stage + 1}P${obs.period + 1} | Budget:$${obs.remaining_budget.toFixed(0)} | SP:${obs.sp}`,
      prompt, thinking, raw_response: rawResponse, parsed_decision: decision, latency_ms: latencyMs, error,
    });
  }

  saveLLMLogs(): void {
    if (this.logs.length === 0) return;
    const filepath = path.join(this.logDir, `llm_log_${this.bot_id}_${Date.now()}.json`);
    const output = {
      bot_id: this.bot_id,
      provider: this.provider,
      model: this.model,
      system_prompt: this.systemPrompt,
      conversation: this.conversationHistory.map((m, i) => ({ turn: i + 1, role: m.role, content: m.content })),
      periods: this.logs,
    };
    fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
    console.log(`  💾 LLM logs saved: ${filepath}`);
  }

  getLogs(): LLMLogEntry[] { return [...this.logs]; }
  getConversationHistory(): ConversationMessage[] { return [...this.conversationHistory]; }
}
