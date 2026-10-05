import { z } from 'zod';

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  CRON_SECRET: z.string().min(1, 'CRON_SECRET is required'),
  LASTFM_API_KEY: z.string().min(1, 'LASTFM_API_KEY is required'),
  TICKETMASTER_API_KEY: z.string().min(1, 'TICKETMASTER_API_KEY is required'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1, 'TELEGRAM_WEBHOOK_SECRET is required'),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  RESEND_FROM_EMAIL: z.string().email('RESEND_FROM_EMAIL must be a valid email'),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

function validateServerEnv(): ServerEnv {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ✗ ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `❌ Missing or invalid server environment variables:\n${formatted}\n\nSee .env.example for required variables.`
    );
  }
  return result.data;
}

function validateClientEnv(): ClientEnv {
  const result = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ✗ ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `❌ Missing or invalid client environment variables:\n${formatted}\n\nSee .env.example for required variables.`
    );
  }
  return result.data;
}

// Lazy singletons — validated once on first access
let _serverEnv: ServerEnv | null = null;
let _clientEnv: ClientEnv | null = null;

/** Server-only env vars. Throws immediately if any are missing. */
export function serverEnv(): ServerEnv {
  if (!_serverEnv) _serverEnv = validateServerEnv();
  return _serverEnv;
}

/** Client-safe env vars (NEXT_PUBLIC_* only). Throws immediately if any are missing. */
export function clientEnv(): ClientEnv {
  if (!_clientEnv) _clientEnv = validateClientEnv();
  return _clientEnv;
}
