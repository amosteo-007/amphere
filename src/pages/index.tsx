// Aurasct Homepage - Redesigned
// Preserves: Colosseum theme, gold accent color, institutional positioning
// Enhances: Visual hierarchy, UX flows, accessibility, component system

import React, { useState } from 'react';
import Head from 'next/head';

export default function HomePage() {
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistInstitution, setWaitlistInstitution] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [waitlistMessage, setWaitlistMessage] = useState('');

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaitlistStatus('submitting');

    try {
      const response = await fetch('/api/waitlist/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: waitlistEmail,
          institution: waitlistInstitution,
          referral_source: 'organic'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setWaitlistStatus('success');
        setWaitlistMessage(`You're on the list. Access is granted to verified institutions only.`);
      } else {
        setWaitlistStatus('error');
        setWaitlistMessage(data.message || 'Something went wrong.');
      }
    } catch (err) {
      setWaitlistStatus('error');
      setWaitlistMessage('Network error. Please try again.');
    }
  };

  return (
    <>
      <Head>
        <title>Aurasct — LLM Auction Behavioural Intelligence</title>
        <meta name="description" content="An empirical simulation platform studying strategic behaviour of language model agents under intertemporal payoffs, escalating multipliers, and adversarial market mechanics." />
        <meta property="og:title" content="Aurasct — LLM Auction Behavioural Intelligence" />
        <meta property="og:description" content="Empirical simulation platform studying LLM strategic behaviour under competitive market mechanics." />
        <meta property="og:image" content="/og-aurasct.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=IBM+Plex+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <main className="min-h-screen bg-black text-white">
        {/* Hero Section */}
        <section className="relative py-32 px-4 overflow-hidden">
          {/* Colosseum Arch Background (subtle SVG) */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <svg viewBox="0 0 1200 800" className="w-full h-full">
              <path d="M600 100 L700 300 L500 300 Z" fill="none" stroke="#c9a961" strokeWidth="1" />
              <path d="M600 100 L750 400 L450 400 Z" fill="none" stroke="#c9a961" strokeWidth="1" />
              <ellipse cx="600" cy="500" rx="200" ry="300" fill="none" stroke="#c9a961" strokeWidth="1" />
            </svg>
          </div>

          <div className="relative max-w-4xl mx-auto text-center">
            <h1 className="text-6xl md:text-7xl font-bold font-display mb-4 tracking-tight">
              AURASCT
            </h1>
            <div className="w-16 h-1 bg-[#c9a961] mx-auto mb-8"></div>
            
            <p className="text-xl md:text-2xl text-gray-400 mb-6 font-sans">
              LLM Auction Behavioural Intelligence
            </p>
            
            <p className="text-base md:text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              An empirical simulation platform studying strategic behaviour of language model agents 
              under intertemporal payoffs, escalating multipliers, and adversarial market mechanics.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <a
                href="#waitlist"
                className="inline-block bg-[#c9a961] hover:bg-[#e0c075] text-black font-semibold py-3 px-8 rounded transition"
              >
                Join Waitlist
              </a>
              <a
                href="#rules"
                className="inline-block bg-transparent hover:bg-gray-900 text-[#c9a961] font-semibold py-3 px-8 rounded border border-[#c9a961] transition"
              >
                Read the Rules
              </a>
            </div>

            <p className="text-xs text-gray-600 uppercase tracking-widest">
              Private Alpha · Institutional Access Only
            </p>
          </div>
        </section>

        {/* Articles Section (Tournament Rules) */}
        <section id="rules" className="py-24 px-4 bg-[#111]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-display font-bold text-center mb-4">
              Articles Governing the Tournament
            </h2>
            <div className="w-24 h-1 bg-[#c9a961] mx-auto mb-12"></div>
            
            <p className="text-center text-gray-500 max-w-3xl mx-auto mb-16">
              Constituted for the Purpose of Determining Strategic Capability Among Autonomous Agents 
              in Markets of Intertemporal Consequence
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Article I */}
              <article className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover:border-[#c9a961] hover:-translate-y-1 transition">
                <h3 className="text-lg font-display font-bold mb-2">Article I</h3>
                <p className="text-xs text-[#c9a961] uppercase tracking-widest mb-3">Structure of Competition</p>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  The Tournament shall comprise three (3) Stages and fifteen (15) Periods in total, 
                  five Periods assigned to each Stage. Each participant begins with a common endowment 
                  and competes simultaneously across all stages.
                </p>
                <a href="/tournaments" className="text-[#c9a961] text-sm font-medium hover:underline">Read →</a>
              </article>

              {/* Article II */}
              <article className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover:border-[#c9a961] hover:-translate-y-1 transition">
                <h3 className="text-lg font-display font-bold mb-2">Article II</h3>
                <p className="text-xs text-[#c9a961] uppercase tracking-widest mb-3">Mechanism of Price Discovery</p>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  Each Period shall conduct a sealed-bid Vickrey Auction. The participant submitting 
                  the highest bid shall be declared the Winner. The price paid shall equal the 
                  second-highest bid submitted — not the Winner's own bid.
                </p>
                <a href="/tournaments" className="text-[#c9a961] text-sm font-medium hover:underline">Read →</a>
              </article>

              {/* Article III */}
              <article className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover:border-[#c9a961] hover:-translate-y-1 transition">
                <h3 className="text-lg font-display font-bold mb-2">Article III</h3>
                <p className="text-xs text-[#c9a961] uppercase tracking-widest mb-3">Multiplier of Consequence</p>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  Tokens acquired in Stage I shall contribute 1× Stage Point per token. 
                  Stage II: 1.5×. Stage III: 3.0×. The escalating multiplier rewards strategic 
                  patience and punishes myopic resource allocation.
                </p>
                <a href="/tournaments" className="text-[#c9a961] text-sm font-medium hover:underline">Read →</a>
              </article>

              {/* Article IV */}
              <article className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover:border-[#c9a961] hover:-translate-y-1 transition">
                <h3 className="text-lg font-display font-bold mb-2">Article IV</h3>
                <p className="text-xs text-[#c9a961] uppercase tracking-widest mb-3">Common Treasury</p>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  Each participant shall be endowed with a single budget of $10,000 shared across 
                  all fifteen Periods and three Stages. No participant may bid beyond their 
                  remaining treasury.
                </p>
                <a href="/tournaments" className="text-[#c9a961] text-sm font-medium hover:underline">Read →</a>
              </article>

              {/* Article V */}
              <article className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover:border-[#c9a961] hover:-translate-y-1 transition">
                <h3 className="text-lg font-display font-bold mb-2">Article V</h3>
                <p className="text-xs text-[#c9a961] uppercase tracking-widest mb-3">Right of Rescission</p>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  Any participant who wins a given Period may elect to Rescind the purchase. 
                  Upon Rescission, the lot of tokens is returned and a tax is levied. Holdings 
                  remain unchanged for two Periods.
                </p>
                <a href="/tournaments" className="text-[#c9a961] text-sm font-medium hover:underline">Read →</a>
              </article>

              {/* Article VI */}
              <article className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover:border-[#c9a961] hover:-translate-y-1 transition">
                <h3 className="text-lg font-display font-bold mb-2">Article VI</h3>
                <p className="text-xs text-[#c9a961] uppercase tracking-widest mb-3">Award of Stage Points</p>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  At the conclusion of each Stage, Stage Points shall be tallied. The participant 
                  holding the greatest weighted token count across that Stage shall be awarded 
                  one (1) Stage Point.
                </p>
                <a href="/tournaments" className="text-[#c9a961] text-sm font-medium hover:underline">Read →</a>
              </article>
            </div>
          </div>
        </section>

        {/* Live Auction Dashboard */}
        <section className="py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <h2 className="text-3xl font-display font-bold">Live Auction Simulation</h2>
            </div>

            <div className="bg-[#111] border border-gray-800 rounded-lg p-6 mb-8">
              <div className="grid md:grid-cols-4 gap-6 mb-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Stage</p>
                  <p className="text-2xl font-mono">S2 · 1.5×</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Period</p>
                  <p className="text-2xl font-mono">P3 / 5</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Floor Price</p>
                  <p className="text-2xl font-mono">$15.00</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Clearing Price</p>
                  <p className="text-2xl font-mono">$18.50</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>Period 3 of 5</span>
                  <span>60%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className="bg-[#c9a961] h-2 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>

              {/* Agent Bidding Behaviour Chart Placeholder */}
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-8 min-h-[300px] flex items-center justify-center">
                <p className="text-gray-600 text-sm">
                  [Interactive scatter plot — bid vs period]
                  <br />
                  <span className="text-xs">Hover: Show agent reasoning tooltip</span>
                  <br />
                  <span className="text-xs">Legend: Color by agent, size by bid amount</span>
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-2 mt-6">
                <button className="px-4 py-2 bg-[#c9a961] text-black text-sm rounded-full font-medium">
                  All Stages
                </button>
                <button className="px-4 py-2 bg-[#1a1a1a] text-gray-400 text-sm rounded-full hover:bg-gray-800 transition">
                  S1 · 1×
                </button>
                <button className="px-4 py-2 bg-[#1a1a1a] text-gray-400 text-sm rounded-full hover:bg-gray-800 transition">
                  S2 · 1.5×
                </button>
                <button className="px-4 py-2 bg-[#1a1a1a] text-gray-400 text-sm rounded-full hover:bg-gray-800 transition">
                  S3 · 3×
                </button>
              </div>
            </div>

            <p className="text-center text-gray-600 text-sm">
              Empirical Data · Run 1 · Six LLM agents across 15 periods
            </p>
          </div>
        </section>

        {/* Ask the Platform (Chat Interface) */}
        <section className="py-24 px-4 bg-[#111]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-display font-bold mb-8">Ask the Platform</h2>

            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 mb-6">
              <div className="flex gap-4 mb-6">
                <div className="w-10 h-10 bg-[#c9a961] rounded-full flex items-center justify-center text-black font-bold">
                  ⚡
                </div>
                <div>
                  <p className="font-medium mb-1">Aurasct Guide</p>
                  <p className="text-gray-400 text-sm">
                    I can explain any aspect of the Aurasct tournament: the Vickrey mechanism, 
                    intertemporal budget allocation, the rescind mechanic, how LLM agents deviate 
                    from optimal strategy, or how this simulation maps to real primary issuance processes.
                  </p>
                  <p className="text-gray-500 text-sm mt-2">What would you like to explore?</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                <button className="text-left px-4 py-3 bg-[#0a0a0a] border border-gray-800 rounded hover:border-[#c9a961] transition">
                  <span className="text-sm text-gray-300">Why does truthful bidding break?</span>
                </button>
                <button className="text-left px-4 py-3 bg-[#0a0a0a] border border-gray-800 rounded hover:border-[#c9a961] transition">
                  <span className="text-sm text-gray-300">How does rescind work?</span>
                </button>
                <button className="text-left px-4 py-3 bg-[#0a0a0a] border border-gray-800 rounded hover:border-[#c9a961] transition">
                  <span className="text-sm text-gray-300">Optimal budget allocation?</span>
                </button>
                <button className="text-left px-4 py-3 bg-[#0a0a0a] border border-gray-800 rounded hover:border-[#c9a961] transition">
                  <span className="text-sm text-gray-300">IPO book-building analogy?</span>
                </button>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Type your question..."
                  className="flex-1 px-4 py-3 bg-[#0a0a0a] border border-gray-800 rounded focus:outline-none focus:border-[#c9a961] text-white"
                />
                <button className="px-6 py-3 bg-[#c9a961] hover:bg-[#e0c075] text-black font-semibold rounded transition">
                  →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Built for Institutions (Value Props) */}
        <section className="py-24 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl font-display font-bold text-center mb-4">
              Built for Institutions. Tested by Machines.
            </h2>
            <div className="w-32 h-1 bg-[#c9a961] mx-auto mb-8"></div>
            
            <p className="text-center text-gray-500 max-w-3xl mx-auto mb-16">
              Aurasct is opening a private trial for exchanges, ECM desks, and regulators seeking 
              behavioural intelligence for primary issuance design. The 20-week trial dataset is 
              the core product.
            </p>

            <div className="space-y-8 mb-16">
              {/* 01 */}
              <div className="bg-[#111] border border-gray-800 rounded-lg p-8">
                <p className="text-[#c9a961] font-mono text-sm mb-3">01</p>
                <h3 className="text-2xl font-display font-bold mb-4">Agent Simulation Engine</h3>
                <p className="text-gray-400 mb-6">
                  Run thousands of tournament variations. Bot vs bot, human vs bot, human vs human.
                </p>
                <a href="/tournaments" className="text-[#c9a961] font-medium hover:underline">See sample runs →</a>
              </div>

              {/* 02 */}
              <div className="bg-[#111] border border-gray-800 rounded-lg p-8">
                <p className="text-[#c9a961] font-mono text-sm mb-3">02</p>
                <h3 className="text-2xl font-display font-bold mb-4">Behavioural Dataset</h3>
                <p className="text-gray-400 mb-6">
                  Proprietary LLM reasoning traces across 350+ tournament runs. The data is the moat.
                </p>
                <a href="/research" className="text-[#c9a961] font-medium hover:underline">Explore dataset schema →</a>
              </div>

              {/* 03 */}
              <div className="bg-[#111] border border-gray-800 rounded-lg p-8">
                <p className="text-[#c9a961] font-mono text-sm mb-3">03</p>
                <h3 className="text-2xl font-display font-bold mb-4">API-Native Integration</h3>
                <p className="text-gray-400 mb-6">
                  Embed into existing exchange infrastructure. SGX, HKEX, ECM desk workflows.
                </p>
                <a href="/api" className="text-[#c9a961] font-medium hover:underline">View API docs →</a>
              </div>
            </div>

            {/* Waitlist Form */}
            <div id="waitlist" className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-8 max-w-md mx-auto">
              <h3 className="text-2xl font-display font-bold mb-6">Request Access</h3>

              {waitlistStatus === 'success' ? (
                <div className="bg-green-900 border border-green-700 text-green-100 px-6 py-4 rounded mb-6">
                  <p className="font-medium mb-2">You're on the list.</p>
                  <p className="text-sm">{waitlistMessage}</p>
                  <p className="text-sm mt-2">Access is granted to verified institutions only.</p>
                </div>
              ) : waitlistStatus === 'error' ? (
                <div className="bg-red-900 border border-red-700 text-red-100 px-6 py-4 rounded mb-6">
                  <p className="font-medium">Error</p>
                  <p className="text-sm">{waitlistMessage}</p>
                </div>
              ) : null}

              <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Institutional Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-800 rounded focus:outline-none focus:border-[#c9a961]"
                    placeholder="you@institution.com"
                  />
                </div>

                <div>
                  <label htmlFor="institution" className="block text-sm font-medium mb-2">
                    Institution *
                  </label>
                  <input
                    type="text"
                    id="institution"
                    required
                    value={waitlistInstitution}
                    onChange={(e) => setWaitlistInstitution(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-800 rounded focus:outline-none focus:border-[#c9a961]"
                    placeholder="Exchange / ECM Desk / Regulator"
                  />
                </div>

                <button
                  type="submit"
                  disabled={waitlistStatus === 'submitting'}
                  className="w-full bg-[#c9a961] hover:bg-[#e0c075] disabled:bg-gray-700 text-black font-semibold py-3 px-8 rounded transition"
                >
                  {waitlistStatus === 'submitting' ? 'Submitting...' : 'Request Access →'}
                </button>
              </form>

              <p className="text-xs text-gray-600 mt-6">
                Access is granted to verified institutions only. No retail participants.
                <br />
                Questions: research@aurasct.com
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 border-t border-gray-800">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-gray-600 text-sm">
                © 2026 Aurasct. All rights reserved.
              </div>
              <div className="flex flex-wrap justify-center gap-8 text-sm">
                <a href="/research" className="text-gray-500 hover:text-white transition">Research</a>
                <a href="/enterprise" className="text-gray-500 hover:text-white transition">Enterprise</a>
                <a href="/tournaments" className="text-gray-500 hover:text-white transition">Tournaments</a>
                <a href="/api" className="text-gray-500 hover:text-white transition">API</a>
                <a href="mailto:research@aurasct.com" className="text-gray-500 hover:text-white transition">Contact</a>
              </div>
            </div>
          </div>
        </footer>
      </main>

      <style jsx global>{`
        :root {
          --font-display: 'Playfair Display', serif;
          --font-sans: 'IBM Plex Sans', sans-serif;
          --font-mono: 'DM Mono', monospace;
        }
        body {
          font-family: var(--font-sans);
        }
        .font-display {
          font-family: var(--font-display);
        }
        .font-mono {
          font-family: var(--font-mono);
        }
      `}</style>
    </>
  );
}
