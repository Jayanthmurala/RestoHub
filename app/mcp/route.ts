import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { getTables } from '@/lib/services/tables';
import { getMenu } from '@/lib/services/menu';
import { getKitchens } from '@/lib/services/kitchens';
import {
  getOrders, getOrder, createOrder, setOrderItems,
  applyDiscount, assignKitchen, submitOrder, updateOrderStatus, getKitchenOrders
} from '@/lib/services/orders';
import { generateBill, getBill } from '@/lib/services/bills';
import { getMenuItem } from '@/lib/services/menu';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Default user ID for MCP (system user) - waiter ID 1
const MCP_USER_ID = 1;

function createMcpServer() {
  const server = new McpServer({
    name: 'restohub-mcp',
    version: '1.0.0',
  });

  // ── Tool: get_tables ──────────────────────────────────────────
  server.tool(
    'get_tables',
    'List all restaurant tables with their current status (available/occupied/reserved)',
    {},
    async () => {
      const tables = await getTables();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(tables, null, 2),
        }],
      };
    }
  );

  // ── Tool: get_menu ────────────────────────────────────────────
  server.tool(
    'get_menu',
    'Get the full restaurant menu grouped by category',
    {},
    async () => {
      const items = await getMenu();
      const grouped: Record<string, typeof items> = {};
      for (const item of items) {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(grouped, null, 2),
        }],
      };
    }
  );

  // ── Tool: get_kitchens ────────────────────────────────────────
  server.tool(
    'get_kitchens',
    'List all available kitchens',
    {},
    async () => {
      const kitchens = await getKitchens();
      return { content: [{ type: 'text', text: JSON.stringify(kitchens, null, 2) }] };
    }
  );

  // ── Tool: create_order ────────────────────────────────────────
  server.tool(
    'create_order',
    'Create a new draft order for a table',
    { table_id: z.number().int().positive().describe('The ID of the table') },
    async ({ table_id }) => {
      const order = await createOrder(table_id, MCP_USER_ID);
      return {
        content: [{
          type: 'text',
          text: `Order created successfully!\nOrder ID: ${order.id}\nOrder Number: ${order.order_number}\nTable: ${order.table_name}\nStatus: ${order.status}`,
        }],
      };
    }
  );

  // ── Tool: add_items ───────────────────────────────────────────
  server.tool(
    'add_items',
    'Add or update items in an order. Provide an array of {menu_item_id, quantity} pairs. Use quantity=0 to remove an item.',
    {
      order_id: z.number().int().positive().describe('The order ID'),
      items: z.array(z.object({
        menu_item_id: z.number().int().positive().describe('Menu item ID'),
        quantity: z.number().int().min(0).describe('Quantity (0 to remove)'),
      })).describe('Items to add/update'),
    },
    async ({ order_id, items }) => {
      const order = await getOrder(order_id);
      if (!order) return { content: [{ type: 'text', text: 'Error: Order not found' }] };
      if (order.status !== 'draft') return { content: [{ type: 'text', text: `Error: Cannot modify order in status: ${order.status}` }] };

      // Build full items list: merge existing + new
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
      const itemList = updated.items.map(i => `  - ${i.name} x${i.quantity} @ Rs.${i.unit_price}`).join('\n');
      return {
        content: [{
          type: 'text',
          text: `Items updated for Order ${updated.order_number}:\n${itemList}\n\nSubtotal: Rs.${updated.subtotal}\nDiscount: ${updated.discount_pct}%\nTotal: Rs.${updated.total}`,
        }],
      };
    }
  );

  // ── Tool: apply_discount ──────────────────────────────────────
  server.tool(
    'apply_discount',
    'Apply a percentage discount to an order',
    {
      order_id: z.number().int().positive(),
      discount_pct: z.number().min(0).max(100).describe('Discount percentage (0-100)'),
    },
    async ({ order_id, discount_pct }) => {
      const order = await applyDiscount(order_id, discount_pct);
      return {
        content: [{
          type: 'text',
          text: `Discount of ${discount_pct}% applied to Order ${order.order_number}.\nSubtotal: Rs.${order.subtotal}\nDiscount: Rs.${order.discount_amount}\nTotal: Rs.${order.total}`,
        }],
      };
    }
  );

  // ── Tool: assign_kitchen ──────────────────────────────────────
  server.tool(
    'assign_kitchen',
    'Assign an order to a kitchen',
    {
      order_id: z.number().int().positive(),
      kitchen_id: z.number().int().positive().describe('Kitchen ID (1=Main, 2=Chinese, 3=Fast Food)'),
    },
    async ({ order_id, kitchen_id }) => {
      const order = await assignKitchen(order_id, kitchen_id);
      return {
        content: [{
          type: 'text',
          text: `Order ${order.order_number} assigned to ${order.kitchen_name ?? 'kitchen'}.`,
        }],
      };
    }
  );

  // ── Tool: submit_order ────────────────────────────────────────
  server.tool(
    'submit_order',
    'Submit an order to the kitchen (order must have items and a kitchen assigned)',
    { order_id: z.number().int().positive() },
    async ({ order_id }) => {
      const order = await submitOrder(order_id);
      return {
        content: [{
          type: 'text',
          text: `Order ${order.order_number} submitted successfully!\nTable: ${order.table_name}\nKitchen: ${order.kitchen_name}\nItems: ${order.items.length}\nTotal: Rs.${order.total}\nStatus: ${order.status}`,
        }],
      };
    }
  );

  // ── Tool: get_order_status ────────────────────────────────────
  server.tool(
    'get_order_status',
    'Get the current status and details of an order',
    { order_id: z.number().int().positive() },
    async ({ order_id }) => {
      const order = await getOrder(order_id);
      if (!order) return { content: [{ type: 'text', text: 'Order not found' }] };
      return { content: [{ type: 'text', text: JSON.stringify(order, null, 2) }] };
    }
  );

  // ── Tool: update_order_status ─────────────────────────────────
  server.tool(
    'update_order_status',
    'Update order status (preparing → ready → paid)',
    {
      order_id: z.number().int().positive(),
      status: z.enum(['preparing', 'ready', 'paid', 'cancelled']),
    },
    async ({ order_id, status }) => {
      const order = await updateOrderStatus(order_id, status);
      return { content: [{ type: 'text', text: `Order ${order.order_number} status updated to: ${status}` }] };
    }
  );

  // ── Tool: get_order_history ───────────────────────────────────
  server.tool(
    'get_order_history',
    'Get recent order history',
    { limit: z.number().int().min(1).max(50).default(20).describe('Number of recent orders to return') },
    async ({ limit }) => {
      const orders = await getOrders(limit);
      return { content: [{ type: 'text', text: JSON.stringify(orders, null, 2) }] };
    }
  );

  // ── Tool: get_kitchen_orders ──────────────────────────────────
  server.tool(
    'get_kitchen_orders',
    'Get all active orders in the kitchen (submitted/preparing/ready)',
    {},
    async () => {
      const orders = await getKitchenOrders();
      return { content: [{ type: 'text', text: JSON.stringify(orders, null, 2) }] };
    }
  );

  // ── Tool: generate_bill ───────────────────────────────────────
  server.tool(
    'generate_bill',
    'Generate a PDF bill for an order and return bill details with download URL',
    { order_id: z.number().int().positive() },
    async ({ order_id }) => {
      const bill = await generateBill(order_id);
      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      const downloadUrl = `${baseUrl}/api/bills/${order_id}?download=true`;
      const viewUrl = `${baseUrl}${bill.pdf_path}`;

      // Try to provide PDF content for MCP clients that support file downloads
      const filePath = join(process.cwd(), 'public', bill.pdf_path);
      if (existsSync(filePath)) {
        try {
          const pdfBuffer = readFileSync(filePath);
          const base64 = pdfBuffer.toString('base64');
          return {
            content: [
              {
                type: 'text',
                text: [
                  `Bill generated for Order ${bill.order_number}`,
                  `Table: ${bill.table_name}`,
                  `Subtotal: Rs.${bill.subtotal}`,
                  bill.discount_pct > 0 ? `Discount (${bill.discount_pct}%): -Rs.${bill.discount_amount}` : null,
                  `Total: Rs.${bill.total}`,
                  ``,
                  `View PDF: ${viewUrl}`,
                  `Download via API: ${downloadUrl}`,
                ].filter(Boolean).join('\n'),
              },
              {
                type: 'resource',
                resource: {
                  uri: viewUrl,
                  mimeType: 'application/pdf',
                  blob: base64,
                },
              },
            ],
          };
        } catch {
          // Fall through
        }
      }

      return {
        content: [{
          type: 'text',
          text: [
            `Bill generated for Order ${bill.order_number}`,
            `Table: ${bill.table_name}`,
            `Subtotal: Rs.${bill.subtotal}`,
            `Total: Rs.${bill.total}`,
            ``,
            `Download: ${downloadUrl}`,
          ].join('\n'),
        }],
      };
    }
  );

  return server;
}

// MCP HTTP transport (Streamable HTTP - the modern MCP transport)
export async function POST(req: NextRequest) {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  const res = new Response(null, { status: 200 });
  
  try {
    await server.connect(transport);
    const body = await req.json();
    await transport.handleRequest(req as unknown as import('http').IncomingMessage, res as unknown as import('http').ServerResponse, body);
    return res;
  } catch (e: unknown) {
    console.error('MCP error:', e);
    return NextResponse.json({ error: 'MCP server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'RestoHub MCP Server',
    version: '1.0.0',
    tools: [
      'get_tables', 'get_menu', 'get_kitchens', 'create_order', 'add_items',
      'apply_discount', 'assign_kitchen', 'submit_order', 'get_order_status',
      'update_order_status', 'get_order_history', 'get_kitchen_orders', 'generate_bill',
    ],
    transport: 'streamable-http',
    endpoint: '/mcp',
  });
}
