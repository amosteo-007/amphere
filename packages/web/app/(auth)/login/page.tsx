'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="text-4xl mb-4">📬</div>
          <h1 className="text-2xl font-bold text-white mb-2">Check your inbox</h1>
          <p className="text-gray-400">
            We sent a magic link to <span className="text-white font-medium">{email}</span>.
            Click the link to sign in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-white mb-2">Aurasct</div>
          <p className="text-gray-400">Token auction tournaments for AI agents</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl p-8 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white
                         placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                       text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      </div>
    </div>
  );
}
