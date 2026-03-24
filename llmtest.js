// Test magistral-small-latest reflection with 8192 tokens
// Run: node --env-file=.env --input-type=module < llmtest.js

const systemPrompt = 'You are a strategic analyst reviewing your own performance in a competitive auction tournament. Respond with detailed, honest analysis.';

const userMessage = `You just competed in a token auction tournament as agent "google_3_base".

FINAL RESULT: third place (out of 5) — 4 SP, 480 weighted points.
Budget: spent $9082 of $10,000. Remaining: $918.

PERIOD-BY-PERIOD LOG:
  S1P1: bid $15.50 → lost (winner: anthropic_2_base, clearing: $16.50)
  S1P2: bid $18.50 → WON (clearing: $18.00, rescind: NO)
  S1P3: bid $20.50 → WON (clearing: $20.00, rescind: NO)
  S1P4: bid $21.50 → lost (winner: anthropic_2_base, clearing: $23.00)
  S1P5: bid $26.50 → lost (winner: anthropic_2_base, clearing: $26.50)
  S2P1: bid $28.50 → WON (clearing: $28.00, rescind: NO)
  S2P2: bid $18.50 → lost (winner: deepseek_5_base, clearing: $28.01)
  S2P3: bid $22.50 → lost (winner: deepseek_5_base, clearing: $28.01)
  S2P4: bid $28.50 → lost (winner: deepseek_5_base, clearing: $28.51)
  S2P5: bid $33.33 → WON (clearing: $28.52, rescind: NO)
  S3P1: bid skip → lost (winner: deepseek_5_base, clearing: $36.00)
  S3P2: bid skip → lost (winner: anthropic_2_base, clearing: $36.01)
  S3P3: bid skip → lost (winner: deepseek_5_base, clearing: $36.01)
  S3P4: bid skip → lost (winner: mistral_1_base, clearing: $36.01)
  S3P5: bid skip → lost (winner: groq_4_base, clearing: $28.00)

Reflect on your strategy. What worked? What failed? What would you do differently in future tournaments?`;

for (const maxTokens of [1000, 4096, 8192]) {
  console.log(`\n=== magistral-small-latest max_tokens=${maxTokens} ===`);
  const start = Date.now();
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'magistral-small-latest',
      max_tokens: maxTokens,
      temperature: 0.7,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const parsed = await res.json();
  const msg = parsed.choices?.[0]?.message;
  const contentRaw = msg?.content;

  const textBlocks = Array.isArray(contentRaw) ? contentRaw.filter(c => c.type === 'text') : [];
  const thinkingBlocks = Array.isArray(contentRaw) ? contentRaw.filter(c => c.type === 'thinking') : [];
  const text = Array.isArray(contentRaw)
    ? textBlocks.map(c => String(c.text ?? '')).join('')
    : String(contentRaw ?? '');

  console.log(`time: ${elapsed}s | finish_reason: ${parsed.choices?.[0]?.finish_reason}`);
  console.log(`tokens: prompt=${parsed.usage?.prompt_tokens} completion=${parsed.usage?.completion_tokens}`);
  if (Array.isArray(contentRaw)) {
    console.log(`blocks: ${thinkingBlocks.length} thinking, ${textBlocks.length} text`);
  }
  console.log(`text (first 300 chars): ${text.slice(0, 300) || '(EMPTY)'}`);
}
