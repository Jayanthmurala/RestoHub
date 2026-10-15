'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const NAV = [
  { href: '/',          label: 'Dashboard',  icon: '▦' },
  { href: '/tables',    label: 'Tables',     icon: '⊞' },
  { href: '/orders',    label: 'Orders',     icon: '≡' },
  { href: '/kitchen',   label: 'Kitchen',    icon: '♨' },
  { href: '/menu',      label: 'Menu',       icon: '☰' },
  { href: '/reports',   label: 'Reports',    icon: '⊟' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as { name?: string; email?: string; role?: string } | undefined;

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, color: 'var(--color-accent)' }}>🍽</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>RestoHub</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Restaurant Management
            </div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <div style={{ padding: '10px 8px', flex: 1 }}>
        {NAV.map(({ href, label, icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 6,
              marginBottom: 2,
              color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
              backgroundColor: active ? 'var(--color-surface-2)' : 'transparent',
              fontWeight: active ? 600 : 400,
              fontSize: 13,
              transition: 'background 0.12s',
            }}>
              <span style={{ fontSize: 14, width: 18, textAlign: 'center', opacity: active ? 1 : 0.6 }}>{icon}</span>
              {label}
              {active && <span style={{ marginLeft: 'auto', width: 3, height: 16, background: 'var(--color-accent)', borderRadius: 2 }} />}
            </Link>
          );
        })}
      </div>

      {/* User */}
      <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 14px' }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{user?.name ?? 'Staff'}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{user?.email}</div>
          <div style={{ marginTop: 3 }}>
            <span className={`badge badge-${user?.role === 'manager' ? 'ready' : 'submitted'}`} style={{ fontSize: 9 }}>
              {user?.role ?? 'waiter'}
            </span>
          </div>
        </div>
        <button
          className="btn-ghost"
          style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
