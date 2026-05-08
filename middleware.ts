import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_FILE = /\.(.*)$/;

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token'));
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

  return atob(padded);
}

function getJwtEmail(token: string) {
  const [, payload] = token.split('.');

  if (!payload) {
    return null;
  }

  try {
    const claims = JSON.parse(decodeBase64Url(payload)) as { email?: string };
    return claims.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function getSessionEmail(request: NextRequest) {
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
    const session = JSON.parse(jsonValue) as { access_token?: string } | [string, string];
    const token = Array.isArray(session) ? session[0] : session.access_token;

    return token ? getJwtEmail(token) : null;
  } catch {
    return null;
  }
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === '/login' ||
    pathname === '/unauthorized' ||
    pathname.startsWith('/_next') ||
    (pathname.startsWith('/api') && !pathname.startsWith('/api/admin')) ||
    pathname === '/favicon.ico' ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (!hasSupabaseSessionCookie(request)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const adminEmails = getAdminEmails();
  const userEmail = getSessionEmail(request);

  if (!userEmail || !adminEmails.includes(userEmail)) {
    const unauthorizedUrl = request.nextUrl.clone();
    unauthorizedUrl.pathname = '/unauthorized';
    unauthorizedUrl.search = '';
    unauthorizedUrl.searchParams.set('message', "You don't have admin access.");
    return NextResponse.redirect(unauthorizedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
