import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTables } from '@/lib/services/tables';
import { getOrders } from '@/lib/services/orders';
import { getKitchens } from '@/lib/services/kitchens';
import Link from 'next/link';

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color ?? 'var(--color-text)', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const [tables, orders, kitchens] = await Promise.all([getTables(), getOrders(100), getKitchens()]);

  const user = session?.user as { name?: string; role?: string };

  const available = tables.filter(t => t.status === 'available').length;
  const occupied = tables.filter(t => t.status === 'occupied').length;
  const todayOrders = orders.filter(o => {
    const d = new Date(o.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const activeOrders = orders.filter(o => ['submitted', 'preparing', 'ready'].includes(o.status));
  const todayRevenue = todayOrders
    .filter(o => o.status === 'paid')
    .reduce((s, o) => s + Number(o.total), 0);

  const recentOrders = orders.slice(0, 8);

  const statusColor: Record<string, string> = {
    draft: 'var(--color-text-muted)',
    submitted: '#60a5fa',
    preparing: 'var(--color-amber)',
    ready: 'var(--color-green)',
    paid: '#818cf8',
    cancelled: 'var(--color-red)',
  };

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Dashboard</span>
          <span style={{ color: 'var(--color-text-muted)', marginLeft: 8, fontSize: 12 }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
        <Link href="/tables" className="btn-primary" style={{ fontSize: 12 }}>
          + New Order
        </Link>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard label="Available Tables" value={available} sub={`${occupied} occupied`} color="var(--color-green)" />
          <StatCard label="Active Orders" value={activeOrders.length} sub="In kitchen / ready" color="var(--color-amber)" />
          <StatCard label="Today's Orders" value={todayOrders.length} sub={`${todayOrders.filter(o => o.status === 'paid').length} paid`} />
          <StatCard label="Today's Revenue" value={`₹${todayRevenue.toFixed(0)}`} sub="Paid orders only" color="var(--color-accent)" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
          {/* Tables overview */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontWeight: 600, fontSize: 13 }}>Table Status</span>
              <Link href="/tables" style={{ fontSize: 12, color: 'var(--color-accent)' }}>Manage →</Link>
            </div>
            <div style={{ padding: 16 }}>
              <div className="tables-grid">
                {tables.map(table => (
                  <Link key={table.id} href="/tables" style={{ textDecoration: 'none' }}>
                    <div className={`table-card ${table.status}`} style={{
                      borderColor: table.status === 'occupied' ? '#92400e' : table.status === 'available' ? 'var(--color-border)' : '#4c1d95',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{table.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 6 }}>{table.capacity}p</div>
                      <span className={`badge badge-${table.status}`} style={{ fontSize: 9 }}>{table.status}</span>
                      {table.current_order_number && (
                        <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 4 }}>
                          {table.current_order_number}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Kitchen status */}
            <div className="card">
              <div className="card-header">
                <span style={{ fontWeight: 600, fontSize: 13 }}>Kitchens</span>
                <Link href="/kitchen" style={{ fontSize: 12, color: 'var(--color-accent)' }}>View →</Link>
              </div>
              <div className="card-body" style={{ padding: '10px 14px' }}>
                {kitchens.map(k => {
                  const kOrders = activeOrders.filter(o => o.kitchen_id === k.id);
                  return (
                    <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{k.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{k.description}</div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: kOrders.length > 0 ? 'var(--color-amber)' : 'var(--color-text-muted)' }}>
                        {kOrders.length}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active orders */}
            <div className="card" style={{ flex: 1 }}>
              <div className="card-header">
                <span style={{ fontWeight: 600, fontSize: 13 }}>Active Orders</span>
              </div>
              <div style={{ overflow: 'auto', maxHeight: 240 }}>
                {activeOrders.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>No active orders</div>
                ) : activeOrders.map(o => (
                  <Link key={o.id} href={`/orders/${o.id}`} style={{ display: 'block', padding: '8px 14px', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{o.order_number}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{o.table_name} · {o.kitchen_name ?? 'No kitchen'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`badge badge-${o.status}`}>{o.status}</span>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>₹{Number(o.total).toFixed(0)}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent orders table */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span style={{ fontWeight: 600, fontSize: 13 }}>Recent Orders</span>
            <Link href="/orders" style={{ fontSize: 12, color: 'var(--color-accent)' }}>All orders →</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Table</th>
                  <th>Staff</th>
                  <th>Kitchen</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/orders/${o.id}`} style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                        {o.order_number}
                      </Link>
                    </td>
                    <td>{o.table_name}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{o.user_name}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{o.kitchen_name ?? '—'}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{o.item_count}</td>
                    <td style={{ fontWeight: 600 }}>₹{Number(o.total).toFixed(0)}</td>
                    <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                      {new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 20 }}>No orders yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
