'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password.');
    } else {
      router.push('/');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
    }}>
      <div style={{ width: 340 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🍽</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>RestoHub</h1>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
            RESTAURANT MANAGEMENT
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Sign In to your account</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <div style={{
                  background: 'var(--color-red-bg)', border: '1px solid var(--color-red)',
                  borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--color-red)',
                  marginBottom: 14,
                }}>
                  {error}
                </div>
              )}
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '9px 0' }} disabled={loading}>
                {loading ? <><span className="spinner" /> Signing in...</> : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        {/* Demo credentials */}
        <div style={{ marginTop: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Demo Credentials
          </div>
          {[
            ['jayanthmurala@gmail.com', '123456789', 'manager'],
            ['waiter@demo.com', 'waiter123', 'waiter'],
          ].map(([e, p, r]) => (
            <button key={e} type="button" className="btn-ghost" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}
              onClick={() => { setEmail(e); setPassword(p); }}>
              <span>{e}</span>
              <span className={`badge badge-${r === 'manager' ? 'ready' : 'submitted'}`}>{r}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
