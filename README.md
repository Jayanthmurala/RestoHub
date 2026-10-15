# RestoHub — Restaurant Management Demo

A full-stack restaurant POS demo showing how **REST APIs** and **MCP (Model Context Protocol)** can drive the same backend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 + Vanilla CSS |
| Database | PostgreSQL (Neon cloud) |
| Auth | NextAuth.js (JWT sessions) |
| PDF | PDFKit |
| MCP | `@modelcontextprotocol/sdk` v1.32 |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Seed the database

The Neon database credentials are already configured. Run:

```bash
npm run seed
```

This creates:
- **12 tables** (T1–T12)
- **3 kitchens** (Main Kitchen, Chinese Kitchen, Fast Food)
- **40 menu items** across 7 categories
- **4 demo users**

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Login Credentials

| Email | Password | Role |
|-------|----------|------|
| `jayanthmurala@gmail.com` | `123456789` | Manager |
| `waiter@demo.com` | `waiter123` | Waiter |
| `manager@demo.com` | `manager123` | Manager |

---

## REST API Reference

All endpoints require authentication (session cookie from login).

### Tables
- `GET /api/tables` — List all tables with status

### Menu
- `GET /api/menu` — List all menu items
- `GET /api/menu?grouped=true` — Grouped by category

### Kitchens
- `GET /api/kitchens` — List all kitchens

### Orders
- `GET /api/orders` — List recent orders
- `POST /api/orders` — Create order `{ table_id }`
- `GET /api/orders/:id` — Get order details
- `PATCH /api/orders/:id` — Update order (action-based):
  - `{ action: "set_items", items: [{menu_item_id, quantity}] }`
  - `{ action: "apply_discount", discount_pct: 10 }`
  - `{ action: "assign_kitchen", kitchen_id: 2 }`
  - `{ action: "update_notes", notes: "..." }`
  - `{ action: "submit" }`
  - `{ action: "update_status", status: "preparing"|"ready"|"paid"|"cancelled" }`

### Bills
- `GET /api/bills/:orderId` — Get bill details
- `GET /api/bills/:orderId?download=true` — Download PDF
- `POST /api/bills/:orderId` — Generate PDF bill

---

## MCP Server

The MCP endpoint is at `/mcp`. It uses the **Streamable HTTP** transport (Web Standards).

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `get_tables` | List all tables with status |
| `get_menu` | Full menu grouped by category |
| `get_kitchens` | List all kitchens |
| `create_order(table_id)` | Create a draft order |
| `add_items(order_id, items[])` | Add items to order |
| `apply_discount(order_id, pct)` | Apply % discount |
| `assign_kitchen(order_id, kitchen_id)` | Assign kitchen |
| `submit_order(order_id)` | Send to kitchen |
| `get_order_status(order_id)` | Get order details |
| `update_order_status(order_id, status)` | Advance status |
| `get_order_history(limit)` | Recent orders |
| `generate_bill(order_id)` | Generate PDF bill |

### Example MCP instruction (for ChatGPT)

> "Add 2 biryanis and 1 Coke to Table 4, apply a 5% discount, assign Kitchen 2, submit the order, and generate the PDF bill."

ChatGPT will call these tools in sequence:
1. `get_tables()` → find Table 4 ID
2. `get_menu()` → find Chicken Biryani and Coke IDs
3. `create_order({ table_id: 4 })`
4. `add_items({ order_id, items: [{id:5, qty:2}, {id:32, qty:1}] })`
5. `apply_discount({ order_id, discount_pct: 5 })`
6. `assign_kitchen({ order_id, kitchen_id: 2 })`
7. `submit_order({ order_id })`
8. `generate_bill({ order_id })` → returns PDF blob

---

## Connecting to ChatGPT (Custom GPT)

1. Deploy the app (Vercel):
   ```bash
   vercel --prod
   ```
2. Go to ChatGPT → **Explore GPTs → Create a GPT → Configure → Actions → Create new action**
3. Configure the Action:
   - **Authentication**: Select **None** *(Do not choose OAuth; OAuth will show discovery error)*
   - **Schema**: Click **Import from URL** and enter:
     ```
     https://your-vercel-domain.vercel.app/api/openapi.json
     ```
     *(Or paste the raw JSON from `/api/openapi.json`)*
4. In the GPT **Instructions**, add:
   ```
   You are an AI restaurant ordering assistant for RestoHub.
   Use the available actions to help staff check tables, browse the menu, create orders, apply discounts, assign kitchens, and generate bills.
   Always confirm the details with the staff before submitting orders.
   ```

---

## Connecting via MCP (Claude Desktop / Cursor / Remote MCP)

For MCP clients that support HTTP / SSE (like Claude Desktop with `mcp-remote`, Cursor, or Windsurf):
- **Server URL**: `https://your-vercel-domain.vercel.app/mcp`
- **Transport**: `streamable-http` (SSE)
- **Auth**: None

---

## Workflow Comparison

### Traditional (REST + UI) — 7 steps
1. Login → Select Table → Add Items → Apply Discount → Select Kitchen → Submit → Generate Bill

### MCP (ChatGPT) — 1 instruction
> "Add 2 biryanis and 1 Coke to Table 4, apply 5% discount, assign Kitchen 2, submit, generate bill"

Both produce identical results in the database. Changes from MCP appear in the dashboard immediately.

---

## Project Structure

```
app/
  api/            ← REST API Route Handlers
    auth/         ← NextAuth
    tables/       ← GET /api/tables
    menu/         ← GET /api/menu
    orders/       ← CRUD /api/orders
    bills/        ← PDF /api/bills
    kitchens/     ← GET /api/kitchens
  mcp/            ← MCP Server at /mcp
  (dashboard)/    ← Protected UI pages
    page.tsx      ← Dashboard
    tables/       ← Table grid
    orders/       ← Order list + detail editor
    kitchen/      ← Kitchen Kanban view
    menu/         ← Menu browser
    reports/      ← Revenue reports
  login/          ← Login page

lib/
  db.ts           ← PostgreSQL pool (Neon)
  auth.ts         ← NextAuth config
  api-helpers.ts  ← Auth middleware
  services/
    tables.ts
    menu.ts
    orders.ts
    kitchens.ts
    bills.ts      ← PDF generation

scripts/
  schema.sql      ← Database schema
  seed.ts         ← Seed data

public/
  bills/          ← Generated PDF files
```
