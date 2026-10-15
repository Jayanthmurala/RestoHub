'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface OrderSummary {
  id: number;
  order_number: string;
  table_name: string;
  user_name: string;
  status: string;
  kitchen_name: string | null;
  item_count: number;
  subtotal: number;
  discount_pct: number;
  total: number;
  created_at: string;
  submitted_at: string | null;
}

const STATUS_FILTER = ['all', 'draft', 'submitted', 'preparing', 'ready', 'paid', 'cancelled'];

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/orders?limit=100');
    if (r.ok) setOrders(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => {
    const matchStatus = filter === 'all' || o.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || o.order_number.toLowerCase().includes(q) || o.table_name.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const counts: Record<string, number> = { all: orders.length };
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;

  return (
    <div>
      <div className="topbar">
        <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>Orders</div>
        <input
          placeholder="Search order / table..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 200, fontSize: 12 }}
        />
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={load}>↻ Refresh</button>
        <Link href="/tables" className="btn-primary" style={{ fontSize: 12 }}>+ New Order</Link>
      </div>

      <div className="page-content">
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
          {STATUS_FILTER.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'var(--color-surface-2)' : 'transparent',
                border: `1px solid ${filter === f ? 'var(--color-border-light)' : 'transparent'}`,
                color: filter === f ? 'var(--color-text)' : 'var(--color-text-muted)',
                padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: filter === f ? 600 : 400,
              }}>
              {f} {counts[f] ? `(${counts[f]})` : ''}
            </button>
          ))}
        </div>

        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Table</th>
                    <th>Staff</th>
                    <th>Kitchen</th>
                    <th>Items</th>
                    <th>Subtotal</th>
                    <th>Discount</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/orders/${o.id}`} style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: 13 }}>
                          {o.order_number}
                        </Link>
                      </td>
                      <td>{o.table_name}</td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{o.user_name}</td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{o.kitchen_name ?? '—'}</td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{o.item_count}</td>
                      <td>₹{Number(o.subtotal).toFixed(0)}</td>
                      <td style={{ color: 'var(--color-amber)' }}>
                        {Number(o.discount_pct) > 0 ? `${o.discount_pct}%` : '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>₹{Number(o.total).toFixed(0)}</td>
                      <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                        {new Date(o.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <Link href={`/orders/${o.id}`} className="btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>View</Link>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                        {search ? 'No orders matching search' : 'No orders found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
