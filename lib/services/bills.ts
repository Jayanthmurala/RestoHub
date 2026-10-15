import PDFDocument from 'pdfkit';
import { query, queryOne } from '@/lib/db';
import { getOrder } from './orders';

export interface Bill {
  id: number;
  order_id: number;
  order_number: string;
  table_name: string;
  subtotal: number;
  discount_pct: number;
  discount_amount: number;
  total: number;
  pdf_path: string;
  created_at: string;
}

function formatINR(amount: number): string {
  return `Rs. ${Number(amount).toFixed(2)}`;
}

export async function createPDFBuffer(order: Awaited<ReturnType<typeof getOrder>>): Promise<Buffer> {
  if (!order) throw new Error('Order not found');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A5' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on('error', (err) => {
      reject(err);
    });

    // Header
    doc.font('Helvetica-Bold').fontSize(20).text('RESTOHUB', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text('Restaurant Management System', { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(370, doc.y).stroke();
    doc.moveDown(0.5);

    // Order info
    const col1 = 50, col2 = 220;
    doc.font('Helvetica-Bold').fontSize(9).text('BILL', col1, doc.y);
    doc.font('Helvetica').fontSize(9);
    const infoY = doc.y;
    doc.text(`Order #:`, col1, infoY).text(order.order_number, col2, infoY);
    const dateY = doc.y;
    doc.text(`Table:`, col1, dateY).text(order.table_name, col2, dateY);
    const kitchenY = doc.y;
    doc.text(`Date:`, col1, kitchenY).text(new Date().toLocaleString('en-IN'), col2, kitchenY);
    const staffY = doc.y;
    doc.text(`Staff:`, col1, staffY).text(order.user_name, col2, staffY);
    if (order.kitchen_name) {
      const k = doc.y;
      doc.text(`Kitchen:`, col1, k).text(order.kitchen_name, col2, k);
    }

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(370, doc.y).stroke();
    doc.moveDown(0.3);

    // Column headers
    const hY = doc.y;
    doc.font('Helvetica-Bold').fontSize(8.5);
    doc.text('Item', 50, hY, { width: 160 });
    doc.text('Qty', 210, hY, { width: 40, align: 'center' });
    doc.text('Price', 250, hY, { width: 60, align: 'right' });
    doc.text('Total', 310, hY, { width: 60, align: 'right' });
    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(370, doc.y).stroke();
    doc.moveDown(0.2);

    // Items
    doc.font('Helvetica').fontSize(8.5);
    for (const item of order.items) {
      const itemY = doc.y;
      const lineTotal = item.quantity * item.unit_price;
      doc.text(item.name, 50, itemY, { width: 160 });
      doc.text(String(item.quantity), 210, itemY, { width: 40, align: 'center' });
      doc.text(formatINR(item.unit_price), 250, itemY, { width: 60, align: 'right' });
      doc.text(formatINR(lineTotal), 310, itemY, { width: 60, align: 'right' });
    }

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(370, doc.y).stroke();
    doc.moveDown(0.3);

    // Totals
    const totalsX = 200;
    const valX = 310;

    const sY = doc.y;
    doc.font('Helvetica').text('Subtotal:', totalsX, sY).text(formatINR(order.subtotal), valX, sY, { width: 60, align: 'right' });

    if (order.discount_pct > 0) {
      const dY = doc.y;
      doc.text(`Discount (${order.discount_pct}%):`, totalsX, dY).text(`- ${formatINR(order.discount_amount)}`, valX, dY, { width: 60, align: 'right' });
    }

    doc.moveDown(0.2);
    doc.moveTo(200, doc.y).lineTo(370, doc.y).stroke();
    doc.moveDown(0.2);
    const tY = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).text('TOTAL:', totalsX, tY).text(formatINR(order.total), valX, tY, { width: 60, align: 'right' });

    doc.moveDown(1.5);
    doc.font('Helvetica').fontSize(8).text('Thank you for dining with us!', { align: 'center' });
    doc.text('Please visit us again.', { align: 'center' });

    doc.end();
  });
}

export async function generateBill(orderId: number): Promise<Bill> {
  const order = await getOrder(orderId);
  if (!order) throw new Error('Order not found');
  if (!['submitted', 'preparing', 'ready', 'paid'].includes(order.status)) {
    throw new Error('Order must be submitted before generating a bill');
  }

  // Check if bill already exists
  const existing = await queryOne<Bill>(
    `SELECT b.*, o.order_number, t.name as table_name 
     FROM bills b 
     JOIN orders o ON o.id = b.order_id 
     JOIN tables t ON t.id = o.table_id 
     WHERE b.order_id = $1`, [orderId]
  );

  // Dynamic route that streams the PDF in memory (serverless friendly)
  const publicPath = `/api/bills/${orderId}?view=true`;

  if (existing) {
    await query(`UPDATE bills SET pdf_path = $2, created_at = NOW() WHERE id = $1`, [existing.id, publicPath]);
    return { ...existing, pdf_path: publicPath };
  }

  const row = await queryOne<{ id: number }>(`
    INSERT INTO bills (order_id, subtotal, discount_amount, total, pdf_path)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [orderId, order.subtotal, order.discount_amount, order.total, publicPath]);

  return {
    id: row!.id,
    order_id: orderId,
    order_number: order.order_number,
    table_name: order.table_name,
    subtotal: order.subtotal,
    discount_pct: order.discount_pct,
    discount_amount: order.discount_amount,
    total: order.total,
    pdf_path: publicPath,
    created_at: new Date().toISOString(),
  };
}

export async function getBill(orderId: number): Promise<Bill | null> {
  return queryOne<Bill>(`
    SELECT b.*, o.order_number, o.discount_pct, t.name as table_name
    FROM bills b
    JOIN orders o ON o.id = b.order_id
    JOIN tables t ON t.id = o.table_id
    WHERE b.order_id = $1
  `, [orderId]);
}
