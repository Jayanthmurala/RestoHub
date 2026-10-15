'use client';

import { useEffect, useState, useCallback } from 'react';
import { showToast } from '@/components/ui/Toaster';

interface OrderItem {
  id: number;
  menu_item_id: number;
  name: string;
  quantity: number;
  unit_price: number;
  category: string;
}

interface Order {
  id: number;
  order_number: string;
  table_name: string;
  status: string;
  kitchen_id: number | null;
  kitchen_name: string | null;
  total: number;
  items: OrderItem[];
  submitted_at: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  submitted: '#60a5fa',
  preparing: 'var(--color-amber)',
  ready: 'var(--color-green)',
};

const NEXT_STATUS: Record<string, string> = {
  submitted: 'preparing',
  preparing: 'ready',
};

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [kitchenFilter, setKitchenFilter] = useState<number | 'all'>('all');

  const load = useCallback(async () => {
    const r = await fetch('/api/orders?limit=100');
    if (r.ok) {
      const all = await r.json();
      const active = all.filter((o: Order) => ['submitted', 'preparing', 'ready'].includes(o.status));
      // Need to load full orders to get items
      const fullOrders = await Promise.all(
        active.slice(0, 20).map((o: Order) => fetch(`/api/orders/${o.id}`).then(r => r.json()))
      );
      setOrders(fullOrders);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [load]);

  async function advance(orderId: number, currentStatus: string) {
    const nextStatus = NEXT_STATUS[currentStatus];
    if (!nextStatus) return;
    setUpdating(orderId);
    try {
      const r = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', status: nextStatus }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      showToast(`Order updated to ${nextStatus}`, 'success');
      load();
    } catch (e: unknown) {
      showToast((e as Error).message, 'error');
    } finally {
      setUpdating(null);
    }
  }

  // Collect kitchen IDs from orders
  const kitchenIds = [...new Set(orders.map(o => o.kitchen_id).filter(Boolean))] as number[];
  const kitchenNames: Record<number, string> = {};
  for (const o of orders) if (o.kitchen_id) kitchenNames[o.kitchen_id] = o.kitchen_name ?? '';

  const filtered = orders.filter(o =>
    kitchenFilter === 'all' ? true : o.kitchen_id === kitchenFilter
  );

  const byStatus = {
    submitted: filtered.filter(o => o.status === 'submitted'),
    preparing: filtered.filter(o => o.status === 'preparing'),
    ready: filtered.filter(o => o.status === 'ready'),
  };

  function elapsed(dt: string | null) {
    if (!dt) return '';
    const mins = Math.floor((Date.now() - new Date(dt).getTime()) / 60000);
    if (mins < 1) return 'just now';
    return `${mins}m ago`;
  }

  function OrderCard({ order }: { order: Order }) {
    const color = STATUS_COLOR[order.status];
    const canAdvance = !!NEXT_STATUS[order.status];
    const btnLabel = order.status === 'submitted' ? 'Start Preparing' : 'Mark Ready';

    return (
      <div style={{
        background: 'var(--color-surface)',
        border: `1px solid ${color}40`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{order.order_number}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{order.table_name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color, fontWeight: 600 }}>{elapsed(order.submitted_at)}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>₹{Number(order.total).toFixed(0)}</div>
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          {order.items.map(item => (
            <div key={item.id} style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 12, padding: '3px 0',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span>{item.name}</span>
              <span style={{ fontWeight: 700, color }}>×{item.quantity}</span>
            </div>
          ))}
        </div>

        {canAdvance && (
          <button
            onClick={() => advance(order.id, order.status)}
            disabled={updating === order.id}
            style={{
              width: '100%',
              background: order.status === 'submitted' ? 'var(--color-amber-bg)' : 'var(--color-green-bg)',
              border: `1px solid ${order.status === 'submitted' ? '#92400e' : '#166534'}`,
              color: order.status === 'submitted' ? 'var(--color-amber)' : 'var(--color-green)',
              borderRadius: 6, padding: '7px 0', fontWeight: 600, fontSize: 12, cursor: 'pointer',
            }}>
            {updating === order.id ? 'Updating...' : btnLabel}
          </button>
        )}
        {order.status === 'ready' && (
          <div style={{
            textAlign: 'center', fontSize: 12, fontWeight: 600,
            color: 'var(--color-green)', padding: '6px 0',
          }}>
            ✓ Ready for service
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="topbar">
        <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>Kitchen View</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setKitchenFilter('all')}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 5,
              background: kitchenFilter === 'all' ? 'var(--color-surface-2)' : 'transparent',
              border: `1px solid ${kitchenFilter === 'all' ? 'var(--color-border-light)' : 'transparent'}`,
              color: kitchenFilter === 'all' ? 'var(--color-text)' : 'var(--color-text-muted)',
            }}>
            All ({orders.length})
          </button>
          {kitchenIds.map(kid => (
            <button key={kid} onClick={() => setKitchenFilter(kid)}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 5,
                background: kitchenFilter === kid ? 'var(--color-surface-2)' : 'transparent',
                border: `1px solid ${kitchenFilter === kid ? 'var(--color-border-light)' : 'transparent'}`,
                color: kitchenFilter === kid ? 'var(--color-text)' : 'var(--color-text-muted)',
              }}>
              {kitchenNames[kid]} ({orders.filter(o => o.kitchen_id === kid).length})
            </button>
          ))}
        </div>
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={load}>↻ Refresh</button>
      </div>

      <div className="page-content">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Loading kitchen orders...</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>♨</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Kitchen is clear</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>No active orders</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {/* Submitted */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#60a5fa' }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>New Orders</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>({byStatus.submitted.length})</span>
              </div>
              {byStatus.submitted.map(o => <OrderCard key={o.id} order={o} />)}
              {byStatus.submitted.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '12px 0' }}>No new orders</div>
              )}
            </div>

            {/* Preparing */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-amber)' }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>Preparing</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>({byStatus.preparing.length})</span>
              </div>
              {byStatus.preparing.map(o => <OrderCard key={o.id} order={o} />)}
              {byStatus.preparing.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '12px 0' }}>Nothing in progress</div>
              )}
            </div>

            {/* Ready */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-green)' }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>Ready for Service</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>({byStatus.ready.length})</span>
              </div>
              {byStatus.ready.map(o => <OrderCard key={o.id} order={o} />)}
              {byStatus.ready.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '12px 0' }}>Nothing ready yet</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
