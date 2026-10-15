import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { getTables } from '@/lib/services/tables';
import { getMenu, getMenuItem } from '@/lib/services/menu';
import { getKitchens } from '@/lib/services/kitchens';
import {
  getOrders, getOrder, createOrder, setOrderItems,
  applyDiscount, assignKitchen, submitOrder, updateOrderStatus,
} from '@/lib/services/orders';
import { generateBill, getBill, createPDFBuffer } from '@/lib/services/bills';
import { verifyAccessToken } from '@/lib/oauth';

function buildServer(userId = 1) {
  const server = new McpServer({
    name: 'restohub-mcp',
    version: '1.0.0',
  });

  // ── get_tables ────────────────────────────────────────────────
  server.tool('get_tables', 'List all restaurant tables with their current status', {}, async () => {
    const tables = await getTables();
    return { content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }] };
  });

  // ── get_menu ──────────────────────────────────────────────────
  server.tool('get_menu', 'Get the full restaurant menu grouped by category with prices', {}, async () => {
    const items = await getMenu();
    const grouped: Record<string, typeof items> = {};
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }
    return { content: [{ type: 'text', text: JSON.stringify(grouped, null, 2) }] };
  });

  // ── get_kitchens ──────────────────────────────────────────────
  server.tool('get_kitchens', 'List all kitchens (IDs 1=Main, 2=Chinese, 3=Fast Food)', {}, async () => {
    const kitchens = await getKitchens();
    return { content: [{ type: 'text', text: JSON.stringify(kitchens, null, 2) }] };
  });

  // ── create_order ──────────────────────────────────────────────
  server.tool(
    'create_order',
    'Create a new draft order for a table. Returns order ID and order number.',
    { table_id: z.number().int().positive().describe('Table ID (e.g. 4 for Table T4)') },
    async ({ table_id }) => {
      const order = await createOrder(table_id, userId);
      return {
        content: [{
          type: 'text',
          text: `✓ Order created!\n  Order ID: ${order.id}\n  Order #: ${order.order_number}\n  Table: ${order.table_name}\n  Status: ${order.status}`,
        }],
      };
    }
  );

  // ── add_items ─────────────────────────────────────────────────
  server.tool(
    'add_items',
    'Add items to an order. Quantities are cumulative (added on top of existing). Use set_items to replace all items.',
    {
      order_id: z.number().int().positive().describe('Order ID from create_order'),
      items: z.array(z.object({
        menu_item_id: z.number().int().positive().describe('Menu item ID'),
        quantity: z.number().int().min(1).describe('Quantity to add'),
      })).describe('Items to add'),
    },
    async ({ order_id, items }) => {
      const order = await getOrder(order_id);
      if (!order) return { content: [{ type: 'text', text: 'Error: Order not found' }] };
      if (order.status !== 'draft') return { content: [{ type: 'text', text: `Error: Order is ${order.status}, cannot modify` }] };

      const existing = new Map(order.items.map(i => [i.menu_item_id, i.quantity]));
      for (const item of items) {
        existing.set(item.menu_item_id, (existing.get(item.menu_item_id) ?? 0) + item.quantity);
      }

      const enriched = [];
      for (const [menu_item_id, quantity] of existing.entries()) {
        if (quantity <= 0) continue;
        const mi = await getMenuItem(menu_item_id);
        if (!mi) return { content: [{ type: 'text', text: `Error: Menu item ${menu_item_id} not found` }] };
        enriched.push({ menu_item_id, quantity, unit_price: mi.price });
      }

      const updated = await setOrderItems(order_id, enriched);
      const lines = updated.items.map(i => `  ${i.name} ×${i.quantity}  = ₹${(i.quantity * i.unit_price).toFixed(0)}`).join('\n');
      return {
        content: [{
          type: 'text',
          text: `✓ Items updated for ${updated.order_number}:\n${lines}\n\n  Subtotal: ₹${Number(updated.subtotal).toFixed(0)}\n  Discount: ${updated.discount_pct}%  (-₹${Number(updated.discount_amount).toFixed(0)})\n  Total: ₹${Number(updated.total).toFixed(0)}`,
        }],
      };
    }
  );

  // ── apply_discount ────────────────────────────────────────────
  server.tool(
    'apply_discount',
    'Apply a percentage discount to a draft order',
    {
      order_id: z.number().int().positive(),
      discount_pct: z.number().min(0).max(100).describe('Discount % (0-100)'),
    },
    async ({ order_id, discount_pct }) => {
      const order = await applyDiscount(order_id, discount_pct);
      return {
        content: [{
          type: 'text',
          text: `✓ ${discount_pct}% discount applied to ${order.order_number}\n  Subtotal: ₹${Number(order.subtotal).toFixed(0)}\n  Discount: -₹${Number(order.discount_amount).toFixed(0)}\n  Total: ₹${Number(order.total).toFixed(0)}`,
        }],
      };
    }
  );

  // ── assign_kitchen ────────────────────────────────────────────
  server.tool(
    'assign_kitchen',
    'Assign a draft order to a kitchen (1=Main Kitchen, 2=Chinese Kitchen, 3=Fast Food)',
    {
      order_id: z.number().int().positive(),
      kitchen_id: z.number().int().min(1).max(3).describe('Kitchen ID: 1=Main, 2=Chinese, 3=Fast Food'),
    },
    async ({ order_id, kitchen_id }) => {
      const order = await assignKitchen(order_id, kitchen_id);
      return {
        content: [{ type: 'text', text: `✓ Order ${order.order_number} assigned to ${order.kitchen_name}` }],
      };
    }
  );

  // ── submit_order ──────────────────────────────────────────────
  server.tool(
    'submit_order',
    'Submit a draft order to the kitchen. Order must have items and a kitchen assigned.',
    { order_id: z.number().int().positive() },
    async ({ order_id }) => {
      const order = await submitOrder(order_id);
      return {
        content: [{
          type: 'text',
          text: `✓ Order ${order.order_number} submitted!\n  Table: ${order.table_name}\n  Kitchen: ${order.kitchen_name}\n  Items: ${order.items.length}\n  Total: ₹${Number(order.total).toFixed(0)}\n  Status: ${order.status}`,
        }],
      };
    }
  );

  // ── get_order_status ──────────────────────────────────────────
  server.tool(
    'get_order_status',
    'Get current details and status of an order',
    { order_id: z.number().int().positive() },
    async ({ order_id }) => {
      const order = await getOrder(order_id);
      if (!order) return { content: [{ type: 'text', text: 'Order not found' }] };
      return { content: [{ type: 'text', text: JSON.stringify(order, null, 2) }] };
    }
  );

  // ── update_order_status ───────────────────────────────────────
  server.tool(
    'update_order_status',
    'Advance order status: submitted→preparing→ready→paid. Or cancel.',
    {
      order_id: z.number().int().positive(),
      status: z.enum(['preparing', 'ready', 'paid', 'cancelled']),
    },
    async ({ order_id, status }) => {
      const order = await updateOrderStatus(order_id, status);
      return { content: [{ type: 'text', text: `✓ Order ${order.order_number} → ${status}` }] };
    }
  );

  // ── get_order_history ─────────────────────────────────────────
  server.tool(
    'get_order_history',
    'Get recent order history',
    { limit: z.number().int().min(1).max(50).default(20) },
    async ({ limit }) => {
      const orders = await getOrders(limit);
      return { content: [{ type: 'text', text: JSON.stringify(orders, null, 2) }] };
    }
  );

  // ── generate_bill ─────────────────────────────────────────────
  server.tool(
    'generate_bill',
    'Generate a PDF bill for a submitted/preparing/ready order. Returns bill details and a downloadable PDF.',
    { order_id: z.number().int().positive() },
    async ({ order_id }) => {
      const bill = await generateBill(order_id);
      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      const downloadUrl = `${baseUrl}/api/bills/${order_id}?download=true`;
      const viewUrl = `${baseUrl}${bill.pdf_path}`;

      const textContent = [
        `✓ Bill generated for ${bill.order_number}`,
        `  Table: ${bill.table_name}`,
        `  Subtotal: ₹${Number(bill.subtotal).toFixed(2)}`,
        Number(bill.discount_pct) > 0 ? `  Discount (${bill.discount_pct}%): -₹${Number(bill.discount_amount).toFixed(2)}` : null,
        `  Total: ₹${Number(bill.total).toFixed(2)}`,
        ``,
        `  View: ${viewUrl}`,
        `  Download API: ${downloadUrl}`,
      ].filter(Boolean).join('\n');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: { content: any[] } = {
        content: [{ type: 'text', text: textContent }],
      };

      // Attach PDF as resource blob for clients that support it
      try {
        const order = await getOrder(order_id);
        if (order) {
          const pdfBuffer = await createPDFBuffer(order);
          (parts.content as unknown[]).push({
            type: 'resource',
            resource: {
              uri: viewUrl,
              mimeType: 'application/pdf',
              blob: pdfBuffer.toString('base64'),
            },
          });
        }
      } catch { /* skip if buffer creation fails */ }

      return parts;
    }
  );

  return server;
}

function getUserIdFromReq(req: NextRequest): number {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) {
    const verified = verifyAccessToken(auth.slice(7).trim());
    if (verified) return verified.id;
  }
  return 1;
}

// ── Next.js Route Handler ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdFromReq(req);
    const server = buildServer(userId);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
    });
    await server.connect(transport);
    return transport.handleRequest(req);
  } catch (e: unknown) {
    console.error('[MCP] Error:', e);
    return NextResponse.json({ error: 'MCP server error', detail: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Handle SSE GET for streaming, or return info
  const accept = req.headers.get('accept') ?? '';
  if (accept.includes('text/event-stream')) {
    try {
      const userId = getUserIdFromReq(req);
      const server = buildServer(userId);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      return transport.handleRequest(req);
    } catch (e: unknown) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // Info endpoint
  return NextResponse.json({
    name: 'RestoHub MCP Server',
    version: '1.0.0',
    transport: 'streamable-http (web standard)',
    endpoint: '/mcp',
    tools: [
      'get_tables', 'get_menu', 'get_kitchens',
      'create_order', 'add_items', 'apply_discount',
      'assign_kitchen', 'submit_order', 'get_order_status',
      'update_order_status', 'get_order_history', 'generate_bill',
    ],
    setup: {
      chatgpt_custom_gpt: 'Add /mcp as an Action with schema from GET /mcp',
      claude_desktop: 'Use mcp-remote proxy pointing to /mcp',
    },
  });
}

export async function DELETE(req: NextRequest) {
  try {
    const server = buildServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    return transport.handleRequest(req);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
