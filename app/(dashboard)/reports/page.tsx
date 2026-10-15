import { getOrders } from '@/lib/services/orders';
import Link from 'next/link';

export default async function ReportsPage() {
  const orders = await getOrders(200);

  const today = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today);
  const paidOrders = orders.filter(o => o.status === 'paid');
  const todayPaid = todayOrders.filter(o => o.status === 'paid');

  const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);
  const todayRevenue = todayPaid.reduce((s, o) => s + Number(o.total), 0);
  const avgOrderValue = paidOrders.length ? totalRevenue / paidOrders.length : 0;

  // Revenue by table
  const byTable: Record<string, number> = {};
  for (const o of paidOrders) {
    byTable[o.table_name] = (byTable[o.table_name] ?? 0) + Number(o.total);
  }

  // Orders by status
  const byStatus: Record<string, number> = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;

  return (
    <div>
      <div className="topbar">
        <div style={{ fontWeight: 600, fontSize: 14 }}>Reports</div>
      </div>
      <div className="page-content">
        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: "Today's Revenue", value: `₹${todayRevenue.toFixed(0)}`, sub: `${todayPaid.length} paid orders` },
            { label: 'Total Revenue', value: `₹${totalRevenue.toFixed(0)}`, sub: `All time` },
            { label: 'Total Orders', value: orders.length, sub: `${paidOrders.length} paid` },
            { label: 'Avg Order Value', value: `₹${avgOrderValue.toFixed(0)}`, sub: 'Paid orders' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Orders by status */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontWeight: 600, fontSize: 13 }}>Orders by Status</span>
            </div>
            <div className="card-body">
              {Object.entries(byStatus).map(([status, count]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className={`badge badge-${status}`}>{status}</span>
                  <div style={{ flex: 1, margin: '0 12px', height: 6, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.round(count / orders.length * 100)}%`,
                      height: '100%',
                      background: status === 'paid' ? '#818cf8' : status === 'ready' ? 'var(--color-green)' : status === 'preparing' ? 'var(--color-amber)' : 'var(--color-accent)',
                      borderRadius: 3,
                    }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, width: 30, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue by table */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontWeight: 600, fontSize: 13 }}>Revenue by Table</span>
            </div>
            <div className="card-body">
              {Object.entries(byTable)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([table, rev]) => (
                  <div key={table} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{table}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>₹{rev.toFixed(0)}</span>
                  </div>
                ))}
              {Object.keys(byTable).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No paid orders yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Recent paid orders */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span style={{ fontWeight: 600, fontSize: 13 }}>Paid Orders</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{paidOrders.length} total</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Order</th><th>Table</th><th>Staff</th><th>Items</th><th>Total</th><th>Date</th></tr>
              </thead>
              <tbody>
                {paidOrders.slice(0, 20).map(o => (
                  <tr key={o.id}>
                    <td><Link href={`/orders/${o.id}`} style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{o.order_number}</Link></td>
                    <td>{o.table_name}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{o.user_name}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{o.item_count}</td>
                    <td style={{ fontWeight: 600 }}>₹{Number(o.total).toFixed(0)}</td>
                    <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {new Date(o.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {paidOrders.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>No paid orders yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
