/**
 * POST /api/auth/login
 * Unified login: admin credentials from env, team passwords from DB.
 * Rate-limited: 5 failures per username/IP in 5 minutes = lockout.
 */
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createSession, setSessionCookie, constantTimeCompare } from '@/lib/auth';
import { loginSchema } from '@/lib/schemas';



const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

async function checkRateLimit(username: string, ip: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const failedAttempts = await prisma.loginAttempt.count({
    where: {
      username,
      ip,
      success: false,
      createdAt: { gte: windowStart },
    },
  });
  return failedAttempts >= MAX_ATTEMPTS;
}

async function recordAttempt(username: string, ip: string, success: boolean) {
  await prisma.loginAttempt.create({
    data: { username, ip, success },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { username, password } = parsed.data;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Check rate limit
    const isLocked = await checkRateLimit(username, ip);
    if (isLocked) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Try again in 5 minutes.' },
        { status: 429 },
      );
    }

    // Check admin credentials
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'ECELL_ADMIN';

    if (username === adminUsername) {
      if (constantTimeCompare(password, adminPassword)) {
        await recordAttempt(username, ip, true);
        const token = await createSession({ role: 'admin', username });
        const cookie = setSessionCookie(token);

        const response = NextResponse.json({
          success: true,
          role: 'admin',
          redirect: '/admin',
        });
        response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof response.cookies.set>[2]);
        return response;
      } else {
        await recordAttempt(username, ip, false);
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    }

    // Check team credentials
    const team = await prisma.team.findUnique({
      where: { username },
      select: { id: true, name: true, username: true, passwordHash: true },
    });

    if (!team) {
      await recordAttempt(username, ip, false);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const passwordValid = await bcrypt.compare(password, team.passwordHash);
    if (!passwordValid) {
      await recordAttempt(username, ip, false);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await recordAttempt(username, ip, true);
    const token = await createSession({
      role: 'team',
      teamId: team.id,
      username: team.username,
    });
    const cookie = setSessionCookie(token);

    const response = NextResponse.json({
      success: true,
      role: 'team',
      teamName: team.name,
      redirect: '/play',
    });
    response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof response.cookies.set>[2]);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
