// Test gpt-5-mini-2025-08-07 bidding
// Run: node --env-file=.env --input-type=module < llmtest_openai.js

const systemPrompt = `You are a strategic bidder in a sealed-bid Vickrey auction tournament. You compete against other AI agents to acquire tokens across multiple stages. Respond ONLY with valid JSON.`;

const userMessage = `AUCTION STATE:
Stage 1, Period 1 (of 5 periods per stage, 3 stages total)
Tokens available this period: 120
Floor price: $10.00
Your budget remaining: $10,000
Your tokens so far: Stage 1: 0, Stage 2: 0, Stage 3: 0

You must respond with exactly one JSON object:
- To bid: {"bid": <number>} where bid >= 10.00
- To skip: {"skip": true}

Think about what price to bid given the competitive dynamics. Respond with ONLY the JSON object, no other text.`;

console.log('=== Testing gpt-5-mini-2025-08-07 ===\n');

// Test 1: With max_completion_tokens, no temperature
console.log('--- Test 1: max_completion_tokens, no temperature ---');
try {
  const start = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-mini-2025-08-07',
      max_completion_tokens: 2048,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const data = await res.json();
  console.log(`status: ${res.status} | time: ${elapsed}s`);
  if (data.error) {
    console.log('ERROR:', JSON.stringify(data.error));
  } else {
    const msg = data.choices?.[0]?.message;
    console.log(`finish_reason: ${data.choices?.[0]?.finish_reason}`);
    console.log(`tokens: prompt=${data.usage?.prompt_tokens} completion=${data.usage?.completion_tokens}`);
    console.log(`content: ${msg?.content ?? '(null)'}`);
  }
} catch (e) {
  console.log('FETCH ERROR:', e.message);
}

// Test 2: With temperature=0.7 (should fail)
console.log('\n--- Test 2: with temperature=0.7 (expect error) ---');
try {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-mini-2025-08-07',
      max_completion_tokens: 2048,
      temperature: 0.7,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await res.json();
  console.log(`status: ${res.status}`);
  if (data.error) {
    console.log('ERROR:', JSON.stringify(data.error));
  } else {
    console.log(`content: ${data.choices?.[0]?.message?.content ?? '(null)'}`);
  }
} catch (e) {
  console.log('FETCH ERROR:', e.message);
}

// Test 3: With max_tokens (should fail)
console.log('\n--- Test 3: with max_tokens (expect error) ---');
try {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-mini-2025-08-07',
      max_tokens: 2048,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await res.json();
  console.log(`status: ${res.status}`);
  if (data.error) {
    console.log('ERROR:', JSON.stringify(data.error));
  } else {
    console.log(`content: ${data.choices?.[0]?.message?.content ?? '(null)'}`);
  }
} catch (e) {
  console.log('FETCH ERROR:', e.message);
}
