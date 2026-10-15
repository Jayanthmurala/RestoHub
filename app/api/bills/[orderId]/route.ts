import { NextRequest } from 'next/server';
import { generateBill, getBill } from '@/lib/services/bills';
import { requireAuth, apiError, apiSuccess } from '@/lib/api-helpers';
import { readFileSync } from 'fs';
import { join } from 'path';

type Params = { params: Promise<{ orderId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth(req);
  if (error) return error;
  
  const { orderId } = await params;
  const id = parseInt(orderId);
  
  try {
    const bill = await getBill(id);
    if (!bill) return apiError('Bill not found. Generate it first.', 404);
    
    // If download=true, stream the PDF
    if (req.nextUrl.searchParams.get('download') === 'true') {
      const filePath = join(process.cwd(), 'public', bill.pdf_path);
      const fileBuffer = readFileSync(filePath);
      return new Response(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="bill-${bill.order_number}.pdf"`,
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
