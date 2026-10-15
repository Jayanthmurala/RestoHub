'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function AuthorizeForm() {
  const searchParams = useSearchParams();
  const redirectUri = searchParams.get('redirect_uri') ?? '';
  const state = searchParams.get('state') ?? '';
  const clientId = searchParams.get('client_id') ?? 'ChatGPT';
  const scope = searchParams.get('scope') ?? 'read, write';

  const [email, setEmail] = useState('jayanthmurala@gmail.com');
  const [password, setPassword] = useState('123456789');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAuthorize(e: React.FormEvent) {
    e.preventDefault();
    if (!redirectUri) {
      setError('Missing redirect_uri parameter in OAuth request');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, redirect_uri: redirectUri }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to authorize');

      const url = new URL(redirectUri);
      url.searchParams.set('code', data.code);
      if (state) url.searchParams.set('state', state);

      // Redirect back to ChatGPT callback URL
      window.location.href = url.toString();
    } catch (err: unknown) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: '24px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '32px 28px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--color-text)' }}>
            Authorize ChatGPT
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
            <strong>{clientId}</strong> is requesting permission to access your RestoHub restaurant.
          </p>
        </div>

        {/* Permissions summary */}
        <div style={{
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '12px 14px',
          marginBottom: 20,
          fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
            Requested Permissions:
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            <li>View restaurant tables, status & live orders</li>
            <li>Browse menu items & kitchen categories</li>
            <li>Create draft orders & assign kitchens</li>
            <li>Apply percentage discounts & generate PDF bills</li>
          </ul>
        </div>

        {error && (
          <div style={{
            background: 'var(--color-red-bg)',
            border: '1px solid var(--color-red)',
            color: 'var(--color-red)',
            padding: '10px 12px',
            borderRadius: 6,
            fontSize: 12,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuthorize}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              RestoHub Account (Email)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', fontSize: 13, padding: '8px 12px' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', fontSize: 13, padding: '8px 12px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="btn-secondary"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-green"
              style={{ flex: 1, justifyContent: 'center', fontWeight: 600 }}
            >
              {loading ? 'Authorizing...' : 'Authorize'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>
          Default manager credentials are pre-filled for instant connection.
        </div>
      </div>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading OAuth...</div>}>
      <AuthorizeForm />
    </Suspense>
  );
}
