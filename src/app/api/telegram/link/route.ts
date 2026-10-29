import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import { TELEGRAM_TOKEN_EXPIRY_MINUTES } from '@/lib/constants';
import { randomBytes } from 'crypto';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const env = serverEnv();

    // Generate a cryptographically random token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TELEGRAM_TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Clean up any existing tokens for this user
    await admin.from('telegram_link_tokens').delete().eq('user_id', user.id);

    // Insert the new token
    const { error: insertError } = await admin.from('telegram_link_tokens').insert({
      token,
      user_id: user.id,
      expires_at: expiresAt,
    });

    if (insertError) throw insertError;

    // Extract bot username from token (format: 123456:ABC-DEF...)
    // The bot username must be configured; we derive the deep link
    const botToken = env.TELEGRAM_BOT_TOKEN;
    // Get bot info to find username
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botInfo = await botInfoResponse.json() as { ok: boolean; result?: { username: string } };

    if (!botInfo.ok || !botInfo.result?.username) {
      throw new Error('Could not retrieve Telegram bot username');
    }

    const deepLink = `https://t.me/${botInfo.result.username}?start=${token}`;

    return NextResponse.json({
      deep_link: deepLink,
      expires_at: expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate Telegram link';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
