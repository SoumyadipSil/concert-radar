import { NextResponse, type NextRequest } from 'next/server';
import { serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { first_name?: string };
  };
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const env = serverEnv();
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export async function POST(request: NextRequest) {
  // Verify webhook secret
  const env = serverEnv();
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
  if (secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  try {
    const update: TelegramUpdate = await request.json();
    const message = update.message;
    if (!message?.text || !message.chat) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const admin = createAdminClient();

    if (text.startsWith('/start ')) {
      const token = text.slice('/start '.length).trim();
      if (!token) {
        await sendTelegramMessage(chatId, '❌ Invalid link token. Please generate a new link from the app.');
        return NextResponse.json({ ok: true });
      }

      // Look up the token
      const { data: linkToken } = await admin
        .from('telegram_link_tokens')
        .select('user_id, expires_at')
        .eq('token', token)
        .maybeSingle();

      if (!linkToken) {
        await sendTelegramMessage(chatId, '❌ Link token not found. Please generate a new one from Settings.');
        return NextResponse.json({ ok: true });
      }

      if (new Date(linkToken.expires_at) < new Date()) {
        await admin.from('telegram_link_tokens').delete().eq('token', token);
        await sendTelegramMessage(chatId, '❌ This link has expired. Please generate a new one from Settings.');
        return NextResponse.json({ ok: true });
      }

      // Link the Telegram chat to the user's profile
      await admin
        .from('profiles')
        .update({
          telegram_chat_id: chatId,
          notify_telegram: true,
        })
        .eq('id', linkToken.user_id);

      // Clean up the token
      await admin.from('telegram_link_tokens').delete().eq('token', token);

      const firstName = message.from?.first_name ?? 'there';
      await sendTelegramMessage(
        chatId,
        `✅ Hey ${firstName}! Your Telegram is now linked to Concert Radar.\n\nYou'll receive notifications here when artists you follow announce shows near you.\n\nCommands:\n/stop — Disable Telegram notifications\n/status — Check your notification status`
      );
    } else if (text === '/stop') {
      // Find user by chat_id and disable Telegram notifications
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('telegram_chat_id', chatId)
        .maybeSingle();

      if (profile) {
        await admin
          .from('profiles')
          .update({ notify_telegram: false })
          .eq('id', profile.id);
        await sendTelegramMessage(chatId, '🔕 Telegram notifications disabled. You can re-enable them from Settings.');
      } else {
        await sendTelegramMessage(chatId, 'No linked account found. Link your account first from the app.');
      }
    } else if (text === '/status') {
      const { data: profile } = await admin
        .from('profiles')
        .select('id, notify_telegram, city, country_code')
        .eq('telegram_chat_id', chatId)
        .maybeSingle();

      if (profile) {
        const { count: artistCount } = await admin
          .from('followed_artists')
          .select('artist_id', { count: 'exact', head: true })
          .eq('user_id', profile.id);

        const location = [profile.city, profile.country_code].filter(Boolean).join(', ') || 'Not set';
        await sendTelegramMessage(
          chatId,
          `📊 <b>Your Concert Radar Status</b>\n\n` +
          `🔔 Notifications: ${profile.notify_telegram ? 'Enabled' : 'Disabled'}\n` +
          `📍 Location: ${location}\n` +
          `🎤 Following: ${artistCount ?? 0} artists`
        );
      } else {
        await sendTelegramMessage(chatId, 'No linked account found. Link your account first from the app.');
      }
    } else if (text === '/start') {
      await sendTelegramMessage(
        chatId,
        '👋 Welcome to Concert Radar!\n\nTo link your account, go to Settings in the web app and click "Link Telegram".'
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}
