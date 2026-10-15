'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { showToast } from '@/components/ui/Toaster';

interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  kitchen_name: string;
}

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
  user_name: string;
  status: string;
  discount_pct: number;
  notes: string;
  kitchen_id: number | null;
  kitchen_name: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  items: OrderItem[];
  created_at: string;
  submitted_at: string | null;
}

interface Kitchen { id: number; name: string; description: string; }

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [menu, setMenu] = useState<Record<string, MenuItem[]>>({});
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [bill, setBill] = useState<{ pdf_path: string; total: number } | null>(null);
  const [generatingBill, setGeneratingBill] = useState(false);

  const loadOrder = useCallback(async () => {
    const [oRes, mRes, kRes] = await Promise.all([
      fetch(`/api/orders/${id}`),
      fetch('/api/menu?grouped=true'),
      fetch('/api/kitchens'),
    ]);
    if (!oRes.ok) { router.push('/orders'); return; }
    const o: Order = await oRes.json();
    const m = await mRes.json();
    const k = await kRes.json();
    setOrder(o);
    const menuMap: Record<string, MenuItem[]> = {};
    if (Array.isArray(m)) {
      for (const entry of m) {
        if (entry.category && Array.isArray(entry.items)) {
          menuMap[entry.category] = entry.items;
        } else if (entry.category) {
          if (!menuMap[entry.category]) menuMap[entry.category] = [];
          menuMap[entry.category].push(entry);
        }
      }
    } else if (m && typeof m === 'object') {
      Object.assign(menuMap, m);
    }
    setMenu(menuMap);
    setKitchens(k);
    setDiscount(o.discount_pct);
    setNotes(o.notes);
    // Initialize quantities from existing order items
    const q: Record<number, number> = {};
    for (const item of o.items) q[item.menu_item_id] = item.quantity;
    setQuantities(q);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  // Load existing bill
  useEffect(() => {
    fetch(`/api/bills/${id}`).then(r => r.ok ? r.json() : null).then(b => b && setBill(b));
  }, [id]);

  async function patch(action: string, extra: Record<string, unknown> = {}) {
    setSaving(true);
    try {
      const r = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setOrder(data);
      return data;
    } catch (e: unknown) {
      showToast((e as Error).message, 'error');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveItems() {
    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([mid, q]) => ({ menu_item_id: parseInt(mid), quantity: q }));
    const result = await patch('set_items', { items });
    if (result) showToast('Items saved', 'success');
  }

  async function saveDiscount() {
    const result = await patch('apply_discount', { discount_pct: discount });
    if (result) showToast(`Discount ${discount}% applied`, 'success');
  }

  async function saveNotes() {
    await patch('update_notes', { notes });
  }

  async function assignKitchen(kitchenId: number) {
    const result = await patch('assign_kitchen', { kitchen_id: kitchenId });
    if (result) showToast(`Assigned to ${result.kitchen_name}`, 'success');
  }

  async function submitOrder() {
    await saveItems();
    const result = await patch('submit');
    if (result) showToast(`Order ${result.order_number} sent to kitchen!`, 'success');
  }

  async function updateStatus(status: string) {
    const result = await patch('update_status', { status });
    if (result) showToast(`Status updated to ${status}`, 'success');
  }

  async function generateBill() {
    setGeneratingBill(true);
    try {
      const r = await fetch(`/api/bills/${id}`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setBill(data);
      showToast('Bill generated!', 'success');
    } catch (e: unknown) {
      showToast((e as Error).message, 'error');
    } finally {
      setGeneratingBill(false);
    }
  }

  function setQty(menuItemId: number, qty: number) {
    setQuantities(prev => ({ ...prev, [menuItemId]: Math.max(0, qty) }));
  }

  const isDraft = order?.status === 'draft';
  const canSubmit = isDraft && order && order.kitchen_id && Object.values(quantities).some(q => q > 0);
  const canGenerateBill = order && ['submitted', 'preparing', 'ready', 'paid'].includes(order.status);

  // Compute live totals from quantities + menu
  const allMenuItems: MenuItem[] = Object.values(menu).flat();
  const liveSubtotal = Object.entries(quantities).reduce((sum, [mid, qty]) => {
    const item = allMenuItems.find(m => m.id === parseInt(mid));
    return sum + (item?.price ?? 0) * qty;
  }, 0);
  const liveDiscount = liveSubtotal * discount / 100;
  const liveTotal = liveSubtotal - liveDiscount;

  const filteredMenu: Record<string, MenuItem[]> = {};
  const q = menuSearch.toLowerCase();
  for (const [cat, items] of Object.entries(menu)) {
    const f = items.filter(i => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    if (f.length) filteredMenu[cat] = f;
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading order...</div>
  );
  if (!order) return null;

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <Link href="/orders" style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>← Orders</Link>
        <div style={{ flex: 1, marginLeft: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{order.order_number}</span>
          <span style={{ color: 'var(--color-text-muted)', marginLeft: 8, fontSize: 12 }}>
            {order.table_name}
          </span>
        </div>
        <span className={`badge badge-${order.status}`} style={{ marginRight: 8 }}>{order.status}</span>
        {isDraft && (
          <button className="btn-ghost" onClick={loadOrder} style={{ fontSize: 12 }}>↻</button>
        )}
      </div>

      <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        {/* Left: Menu */}
        <div>
          {isDraft && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span style={{ fontWeight: 600, fontSize: 13 }}>Add Items</span>
                <input
                  placeholder="Search menu..."
                  value={menuSearch}
                  onChange={e => setMenuSearch(e.target.value)}
                  style={{ width: 180, fontSize: 12 }}
                />
              </div>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {Object.entries(filteredMenu).map(([cat, items]) => (
                  <div key={cat}>
                    <div style={{
                      padding: '7px 14px',
                      background: 'var(--color-surface-2)',
                      borderBottom: '1px solid var(--color-border)',
                      fontSize: 11, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      color: 'var(--color-text-secondary)',
                      position: 'sticky', top: 0,
                    }}>
                      {cat}
                    </div>
                    {items.map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '9px 14px',
                        borderBottom: '1px solid var(--color-border)',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }} className="truncate">{item.description}</div>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 13, width: 60, textAlign: 'right', flexShrink: 0 }}>
                          ₹{item.price}
                        </div>
                        <div className="qty-control" style={{ flexShrink: 0 }}>
                          <button className="qty-btn" onClick={() => setQty(item.id, (quantities[item.id] ?? 0) - 1)}>−</button>
                          <span className="qty-display">{quantities[item.id] ?? 0}</span>
                          <button className="qty-btn" onClick={() => setQty(item.id, (quantities[item.id] ?? 0) + 1)}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {Object.keys(filteredMenu).length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                    No items match &ldquo;{menuSearch}&rdquo;
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order items (view mode for submitted) */}
          {!isDraft && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span style={{ fontWeight: 600, fontSize: 13 }}>Order Items</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{order.items.length} items</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {order.items.map(item => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>₹{item.unit_price}</td>
                      <td style={{ fontWeight: 600 }}>₹{(item.quantity * item.unit_price).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Kitchen status actions */}
          {['submitted', 'preparing', 'ready'].includes(order.status) && (
            <div className="card">
              <div className="card-header">
                <span style={{ fontWeight: 600, fontSize: 13 }}>Kitchen Actions</span>
              </div>
              <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {order.status === 'submitted' && (
                  <button className="btn-secondary" onClick={() => updateStatus('preparing')} disabled={saving}>
                    Mark Preparing
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button className="btn-green" onClick={() => updateStatus('ready')} disabled={saving}>
                    Mark Ready
                  </button>
                )}
                {order.status === 'ready' && (
                  <button className="btn-primary" onClick={() => updateStatus('paid')} disabled={saving}>
                    Mark Paid
                  </button>
                )}
                <button className="btn-danger" onClick={() => updateStatus('cancelled')} disabled={saving}>
                  Cancel Order
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Order summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Summary */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontWeight: 600, fontSize: 13 }}>Order Summary</span>
            </div>
            <div className="card-body">
              {isDraft && Object.entries(quantities).some(([, q]) => q > 0) ? (
                <>
                  {Object.entries(quantities).filter(([, q]) => q > 0).map(([mid, qty]) => {
                    const item = allMenuItems.find(m => m.id === parseInt(mid));
                    if (!item) return null;
                    return (
                      <div key={mid} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                        <span>{item.name} <span style={{ color: 'var(--color-text-muted)' }}>×{qty}</span></span>
                        <span>₹{(item.price * qty).toFixed(0)}</span>
                      </div>
                    );
                  })}
                  <div className="divider" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    <span>Subtotal</span><span>₹{liveSubtotal.toFixed(0)}</span>
                  </div>
                  {discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-amber)' }}>
                      <span>Discount ({discount}%)</span><span>−₹{liveDiscount.toFixed(0)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, marginTop: 8 }}>
                    <span>Total</span><span>₹{liveTotal.toFixed(0)}</span>
                  </div>
                </>
              ) : !isDraft ? (
                <>
                  {order.items.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span>{item.name} <span style={{ color: 'var(--color-text-muted)' }}>×{item.quantity}</span></span>
                      <span>₹{(item.quantity * item.unit_price).toFixed(0)}</span>
                    </div>
                  ))}
                  <div className="divider" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    <span>Subtotal</span><span>₹{Number(order.subtotal).toFixed(0)}</span>
                  </div>
                  {Number(order.discount_pct) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-amber)' }}>
                      <span>Discount ({order.discount_pct}%)</span><span>−₹{Number(order.discount_amount).toFixed(0)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, marginTop: 8 }}>
                    <span>Total</span><span>₹{Number(order.total).toFixed(0)}</span>
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
                  Add items from the menu
                </div>
              )}
            </div>
          </div>

          {/* Discount */}
          {isDraft && (
            <div className="card">
              <div className="card-header">
                <span style={{ fontWeight: 600, fontSize: 13 }}>Discount</span>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number" min={0} max={100} value={discount}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                    style={{ width: 80 }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>%</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[5, 10, 15, 20].map(p => (
                      <button key={p} className="btn-ghost" style={{ padding: '3px 7px', fontSize: 11 }}
                        onClick={() => setDiscount(p)}>{p}%</button>
                    ))}
                  </div>
                </div>
                <button className="btn-secondary" style={{ marginTop: 8, fontSize: 12 }} onClick={saveDiscount} disabled={saving}>
                  Apply Discount
                </button>
              </div>
            </div>
          )}

          {/* Kitchen assignment */}
          {isDraft && (
            <div className="card">
              <div className="card-header">
                <span style={{ fontWeight: 600, fontSize: 13 }}>Assign Kitchen</span>
                {order.kitchen_name && <span className="badge badge-submitted">{order.kitchen_name}</span>}
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {kitchens.map(k => (
                  <button
                    key={k.id}
                    onClick={() => assignKitchen(k.id)}
                    disabled={saving}
                    style={{
                      background: order.kitchen_id === k.id ? 'var(--color-accent-light)' : 'var(--color-surface-2)',
                      border: `1px solid ${order.kitchen_id === k.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      borderRadius: 6, padding: '8px 12px', textAlign: 'left',
                      cursor: 'pointer', transition: 'border-color 0.15s',
                    }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{k.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{k.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {isDraft && (
            <div className="card">
              <div className="card-header">
                <span style={{ fontWeight: 600, fontSize: 13 }}>Notes</span>
              </div>
              <div className="card-body">
                <textarea
                  placeholder="e.g. less spicy, no onion..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={saveNotes}
                  rows={2}
                  style={{ resize: 'vertical', width: '100%' }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          {isDraft && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn-secondary" onClick={saveItems} disabled={saving} style={{ justifyContent: 'center' }}>
                {saving ? <><span className="spinner" /> Saving...</> : 'Save Items'}
              </button>
              <button className="btn-green" onClick={submitOrder}
                disabled={!canSubmit || saving}
                style={{ justifyContent: 'center', fontSize: 14, padding: '10px 0' }}>
                {saving ? <><span className="spinner" /> Submitting...</> : 'Send to Kitchen →'}
              </button>
              {!canSubmit && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  {Object.values(quantities).every(q => q === 0) ? 'Add items first' : 'Assign a kitchen first'}
                </div>
              )}
            </div>
          )}

          {/* Bill */}
          {canGenerateBill && (
            <div className="card">
              <div className="card-header">
                <span style={{ fontWeight: 600, fontSize: 13 }}>Bill</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn-primary" onClick={generateBill} disabled={generatingBill} style={{ justifyContent: 'center' }}>
                  {generatingBill ? <><span className="spinner" /> Generating...</> : bill ? '↻ Regenerate Bill' : 'Generate PDF Bill'}
                </button>
                {bill && (
                  <div style={{ background: 'var(--color-green-bg)', border: '1px solid var(--color-green)', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: 'var(--color-green)', fontWeight: 600, marginBottom: 8 }}>
                      ✓ Bill Ready — ₹{Number(bill.total).toFixed(0)}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a href={bill.pdf_path} target="_blank" rel="noreferrer" className="btn-secondary" style={{ fontSize: 11, flex: 1, justifyContent: 'center' }}>
                        View PDF
                      </a>
                      <a href={`/api/bills/${id}?download=true`} className="btn-green" style={{ fontSize: 11, flex: 1, justifyContent: 'center' }}>
                        Download
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order info */}
          <div className="card">
            <div className="card-body" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Table</span><span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{order.table_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Staff</span><span>{order.user_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Created</span>
                <span>{new Date(order.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</span>
              </div>
              {order.submitted_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Submitted</span>
                  <span>{new Date(order.submitted_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
