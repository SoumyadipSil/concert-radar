import { NextResponse, type NextRequest } from 'next/server';
import { serverEnv } from './env';

/**
 * Validate that a cron request has the correct Bearer token.
 * Returns null if valid, or a 401 NextResponse if invalid.
 *
 * Usage in a route handler:
 *   const authError = validateCronAuth(request);
 *   if (authError) return authError;
 */
export function validateCronAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Missing Authorization header' },
      { status: 401 }
    );
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return NextResponse.json(
      { error: 'Authorization header must be: Bearer <token>' },
      { status: 401 }
    );
  }

  const { CRON_SECRET } = serverEnv();

  if (token !== CRON_SECRET) {
    return NextResponse.json(
      { error: 'Invalid cron secret' },
      { status: 401 }
    );
  }

  return null;
}
