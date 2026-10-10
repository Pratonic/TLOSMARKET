/**
 * Next.js middleware for route protection.
 * Checks JWT in cookie, redirects unauthenticated users.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Protect /play routes
  if (pathname.startsWith('/play')) {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'team') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Protect API routes (but not auth routes)
  if (pathname.startsWith('/api/admin/')) {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (pathname.startsWith('/api/me/')) {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'team') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/play/:path*', '/api/admin/:path*', '/api/me/:path*'],
};
