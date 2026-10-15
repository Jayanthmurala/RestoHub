export function getOpenApiSpec(origin: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'RestoHub Restaurant Management API',
      description: 'API for restaurant orders, tables, menu, kitchen assignment, and bill generation.',
      version: '1.0.0',
    },
    servers: [
      {
        url: origin,
        description: 'RestoHub Production Server',
      },
    ],
    paths: {
      '/api/tables': {
        get: {
          operationId: 'getTables',
          summary: 'List all tables and their occupancy status',
          responses: {
            '200': {
              description: 'List of tables',
              content: { 'application/json': { schema: { type: 'array' } } },
            },
          },
        },
      },
      '/api/menu': {
        get: {
          operationId: 'getMenu',
          summary: 'Get restaurant menu items and prices',
          parameters: [
            {
              name: 'grouped',
              in: 'query',
              required: false,
              schema: { type: 'boolean', default: true },
              description: 'Whether to group items by category',
            },
          ],
          responses: {
            '200': {
              description: 'Menu items',
              content: { 'application/json': { schema: { type: 'array' } } },
            },
          },
        },
      },
      '/api/kitchens': {
        get: {
          operationId: 'getKitchens',
          summary: 'List available kitchens (1=Main, 2=Chinese, 3=Fast Food)',
          responses: {
            '200': {
              description: 'List of kitchens',
              content: { 'application/json': { schema: { type: 'array' } } },
            },
          },
        },
      },
      '/api/orders': {
        get: {
          operationId: 'getOrders',
          summary: 'List recent orders',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 20 },
            },
          ],
          responses: {
            '200': {
              description: 'Recent orders',
              content: { 'application/json': { schema: { type: 'array' } } },
            },
          },
        },
        post: {
          operationId: 'createOrder',
          summary: 'Create a new draft order for a table',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['table_id'],
                  properties: {
                    table_id: { type: 'integer', description: 'Table ID (e.g. 1, 2, 3)' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Order created',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      },
      '/api/orders/{id}': {
        get: {
          operationId: 'getOrder',
          summary: 'Get order details by order ID',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          responses: {
            '200': {
              description: 'Order details',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
        patch: {
          operationId: 'updateOrder',
          summary: 'Update an order (set items, apply discount, assign kitchen, submit order)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['action'],
                  properties: {
                    action: {
                      type: 'string',
                      enum: ['set_items', 'apply_discount', 'assign_kitchen', 'update_notes', 'submit', 'update_status'],
                      description: 'The operation to perform on the order',
                    },
                    items: {
                      type: 'array',
                      description: 'Used with action: set_items',
                      items: {
                        type: 'object',
                        properties: {
                          menu_item_id: { type: 'integer' },
                          quantity: { type: 'integer' },
                        },
                      },
                    },
                    discount_pct: { type: 'number', description: 'Used with action: apply_discount (0-100)' },
                    kitchen_id: { type: 'integer', description: 'Used with action: assign_kitchen (1, 2, or 3)' },
                    notes: { type: 'string', description: 'Used with action: update_notes' },
                    status: { type: 'string', enum: ['preparing', 'ready', 'paid', 'cancelled'], description: 'Used with action: update_status' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Order updated',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      },
      '/api/bills/{orderId}': {
        get: {
          operationId: 'getBill',
          summary: 'Get bill details or download PDF bill for an order',
          parameters: [
            {
              name: 'orderId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
            {
              name: 'view',
              in: 'query',
              required: false,
              schema: { type: 'boolean' },
              description: 'View PDF stream directly in browser',
            },
            {
              name: 'download',
              in: 'query',
              required: false,
              schema: { type: 'boolean' },
              description: 'Download PDF file as attachment',
            },
          ],
          responses: {
            '200': {
              description: 'Bill information or PDF binary',
            },
          },
        },
        post: {
          operationId: 'generateBill',
          summary: 'Generate a PDF bill for an order',
          parameters: [
            {
              name: 'orderId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          responses: {
            '201': {
              description: 'Bill generated',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      },
    },
  };
}
