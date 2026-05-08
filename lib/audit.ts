import { type NextRequest } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase-admin';

type SupabaseSessionCookie = {
  access_token?: string;
};

type JwtPayload = {
  email?: string;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

  return Buffer.from(padded, 'base64').toString('utf8');
}

function getJwtPayload(token: string) {
  const [, payload] = token.split('.');

  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(payload)) as JwtPayload;
  } catch {
    return null;
  }
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function getCookieToken(request: NextRequest) {
  const sessionCookie = request.cookies
    .getAll()
    .find((cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token'));

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const decodedValue = decodeURIComponent(sessionCookie.value);
    const jsonValue = decodedValue.startsWith('base64-')
      ? decodeBase64Url(decodedValue.replace('base64-', ''))
      : decodedValue;
    const session = JSON.parse(jsonValue) as SupabaseSessionCookie | [string, string];

    return Array.isArray(session) ? session[0] : session.access_token ?? null;
  } catch {
    return null;
  }
}

export async function getAdminEmailFromRequest(request: NextRequest) {
  const token = getBearerToken(request) ?? getCookieToken(request);

  if (!token) {
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (!error && data.user?.email) {
      return data.user.email;
    }
  } catch (error) {
    console.error('Failed to resolve admin email from Supabase session', error);
  }

  return getJwtPayload(token)?.email ?? null;
}

export async function logAudit(
  adminEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  details?: object,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('audit_log').insert({
      admin_email: adminEmail,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details ?? null,
    });

    if (error) {
      console.error('Failed to write audit log', error);
    }
  } catch (error) {
    console.error('Failed to write audit log', error);
  }
}
