import { NextRequest, NextResponse } from 'next/server';
import { getOpenApiSpec } from '@/lib/openapi-spec';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') ?? 'resto-hub-nine.vercel.app';
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;

  return NextResponse.json(getOpenApiSpec(origin), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
