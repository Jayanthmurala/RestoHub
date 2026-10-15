import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthCode, createAccessToken } from '@/lib/oauth';
import { getUser } from '@/lib/services/auth';

export async function POST(req: NextRequest) {
  try {
    let grantType = '';
    let code = '';
    let redirectUri = '';

    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      grantType = (form.get('grant_type') as string) ?? '';
      code = (form.get('code') as string) ?? '';
      redirectUri = (form.get('redirect_uri') as string) ?? '';
    } else {
      const json = await req.json().catch(() => ({}));
      grantType = json.grant_type ?? '';
      code = json.code ?? '';
      redirectUri = json.redirect_uri ?? '';
    }

    if (!code) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing code parameter' },
        { status: 400 }
      );
    }

    const verified = verifyAuthCode(code, redirectUri);
    if (!verified) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
        { status: 400 }
      );
    }

    const user = (await getUser(verified.userId)) ?? {
      id: 1,
      email: 'jayanthmurala@gmail.com',
      name: 'Jayanth Murala',
      role: 'manager' as const,
    };

    const accessToken = createAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 30 * 24 * 60 * 60, // 30 days
      scope: 'read write',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: 'server_error', error_description: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
