import { getMenu } from '@/lib/services/menu';
import { getKitchens } from '@/lib/services/kitchens';

export default async function MenuPage() {
  const [items, kitchens] = await Promise.all([getMenu(), getKitchens()]);

  const grouped: Record<string, typeof items> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  return (
    <div>
      <div className="topbar">
        <div style={{ fontWeight: 600, fontSize: 14 }}>Menu</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{items.length} items</div>
      </div>

      <div className="page-content">
        {/* Kitchen legend */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {kitchens.map(k => (
            <div key={k.id} style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 6, padding: '6px 12px', fontSize: 12,
            }}>
              <span style={{ fontWeight: 600 }}>{k.name}</span>
              <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>— {k.description}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat} className="card">
              <div className="card-header">
                <span style={{ fontWeight: 600, fontSize: 13 }}>{cat}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{catItems.length} items</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Item</th><th>Kitchen</th><th style={{ textAlign: 'right' }}>Price</th></tr>
                </thead>
                <tbody>
                  {catItems.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>{item.description}</div>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>{item.kitchen_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{item.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
