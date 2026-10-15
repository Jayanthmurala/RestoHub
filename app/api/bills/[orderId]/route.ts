import { NextRequest } from 'next/server';
import { generateBill, getBill, createPDFBuffer } from '@/lib/services/bills';
import { getOrder } from '@/lib/services/orders';
import { requireAuth, apiError, apiSuccess } from '@/lib/api-helpers';

type Params = { params: Promise<{ orderId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth(req);
  if (error) return error;

  const { orderId } = await params;
  const id = parseInt(orderId);

  try {
    const bill = await getBill(id);
    if (!bill) return apiError('Bill not found. Generate it first.', 404);

    const isDownload = req.nextUrl.searchParams.get('download') === 'true';
    const isView = req.nextUrl.searchParams.get('view') === 'true';

    // Stream PDF directly from memory
    if (isDownload || isView) {
      const order = await getOrder(id);
      if (!order) return apiError('Order not found', 404);

      const pdfBuffer = await createPDFBuffer(order);
      const disposition = isDownload ? 'attachment' : 'inline';

      return new Response(pdfBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${disposition}; filename="bill-${bill.order_number}.pdf"`,
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    return apiSuccess(bill);
  } catch (e: unknown) {
    return apiError((e as Error).message, 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth(req);
  if (error) return error;

  const { orderId } = await params;
  const id = parseInt(orderId);

  try {
    const bill = await generateBill(id);
    return apiSuccess(bill, 201);
  } catch (e: unknown) {
    return apiError((e as Error).message, 400);
  }
}
