'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/ui/Toaster';

interface Table {
  id: number;
  name: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  current_order_id?: number | null;
  current_order_number?: string | null;
}

export default function TablesPage() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied'>('all');
  const [creating, setCreating] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/tables');
    if (r.ok) setTables(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function selectTable(table: Table) {
    if (table.status === 'occupied' && table.current_order_id) {
      router.push(`/orders/${table.current_order_id}`);
      return;
    }
    if (table.status !== 'available') {
      showToast(`Table ${table.name} is ${table.status}`, 'error');
      return;
    }
    setCreating(table.id);
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: table.id }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const order = await r.json();
      showToast(`Order ${order.order_number} created for ${table.name}`, 'success');
      router.push(`/orders/${order.id}`);
    } catch (e: unknown) {
      showToast((e as Error).message, 'error');
    } finally {
      setCreating(null);
    }
  }

  const filtered = tables.filter(t => filter === 'all' ? true : t.status === filter);
  const counts = {
    all: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
  };

  return (
    <div>
      <div className="topbar">
        <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>Tables</div>
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={load}>↻ Refresh</button>
      </div>
      <div className="page-content">
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(['all', 'available', 'occupied'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'var(--color-surface-2)' : 'transparent',
                border: `1px solid ${filter === f ? 'var(--color-border-light)' : 'transparent'}`,
                color: filter === f ? 'var(--color-text)' : 'var(--color-text-muted)',
                padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: filter === f ? 600 : 400,
              }}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Loading tables...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
            {filtered.map(table => (
              <button key={table.id} onClick={() => selectTable(table)}
                disabled={creating === table.id}
                style={{
                  background: 'var(--color-surface)',
                  border: `1px solid ${
                    table.status === 'occupied' ? '#92400e' :
                    table.status === 'reserved' ? '#4c1d95' : 'var(--color-border)'
                  }`,
                  borderRadius: 8,
                  padding: '18px 12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                {creating === table.id ? (
                  <span className="spinner" />
                ) : (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{table.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{table.capacity} seats</div>
                    <span className={`badge badge-${table.status}`} style={{ fontSize: 10 }}>{table.status}</span>
                    {table.current_order_number && (
                      <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        {table.current_order_number}
                      </div>
                    )}
                    {table.status === 'available' && (
                      <div style={{ fontSize: 10, color: 'var(--color-accent)', marginTop: 2 }}>
                        Click to start order
                      </div>
                    )}
                    {table.status === 'occupied' && (
                      <div style={{ fontSize: 10, color: 'var(--color-amber)', marginTop: 2 }}>
                        Click to view order
                      </div>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <strong>Tip:</strong> Click an available table to create a new order, or click an occupied table to view its current order.
        </div>
      </div>
    </div>
  );
}
