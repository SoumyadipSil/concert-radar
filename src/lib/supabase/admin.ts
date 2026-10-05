import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';
import type { Database } from './types';

let adminClient: ReturnType<typeof createSupabaseClient<Database>> | null = null;

/**
 * Returns a Supabase client with the service role key.
 * This bypasses RLS — use ONLY in server-side cron/ingestion code.
 * Never import this file from client-side code.
 */
export function createAdminClient() {
  if (!adminClient) {
    const env = serverEnv();
    adminClient = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return adminClient;
}
