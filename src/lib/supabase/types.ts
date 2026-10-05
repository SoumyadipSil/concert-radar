/**
 * Database type definitions for Supabase.
 *
 * This file should be regenerated when the schema changes:
 *   npx supabase gen types typescript --local > src/lib/supabase/types.ts
 *
 * The placeholder below provides the minimal shape needed for type-checking
 * until the real types are generated from a running Supabase instance.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          country_code: string | null;
          city: string | null;
          lat: number | null;
          lng: number | null;
          radius_km: number;
          distance_unit: 'km' | 'mi';
          timezone: string;
          lastfm_username: string | null;
          telegram_chat_id: number | null;
          notify_telegram: boolean;
          notify_email: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          country_code?: string | null;
          city?: string | null;
          lat?: number | null;
          lng?: number | null;
          radius_km?: number;
          distance_unit?: 'km' | 'mi';
          timezone?: string;
          lastfm_username?: string | null;
          telegram_chat_id?: number | null;
          notify_telegram?: boolean;
          notify_email?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          country_code?: string | null;
          city?: string | null;
          lat?: number | null;
          lng?: number | null;
          radius_km?: number;
          distance_unit?: 'km' | 'mi';
          timezone?: string;
          lastfm_username?: string | null;
          telegram_chat_id?: number | null;
          notify_telegram?: boolean;
          notify_email?: boolean;
          created_at?: string;
        };
      };
      artists: {
        Row: {
          id: string;
          name: string;
          normalized_name: string;
          mbid: string | null;
          last_checked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          normalized_name: string;
          mbid?: string | null;
          last_checked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          normalized_name?: string;
          mbid?: string | null;
          last_checked_at?: string | null;
          created_at?: string;
        };
      };
      artist_external_ids: {
        Row: {
          artist_id: string;
          provider: string;
          external_id: string | null;
          resolved_at: string;
        };
        Insert: {
          artist_id: string;
          provider: string;
          external_id?: string | null;
          resolved_at?: string;
        };
        Update: {
          artist_id?: string;
          provider?: string;
          external_id?: string | null;
          resolved_at?: string;
        };
      };
      followed_artists: {
        Row: {
          user_id: string;
          artist_id: string;
          source: 'lastfm' | 'manual';
          playcount: number | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          artist_id: string;
          source: 'lastfm' | 'manual';
          playcount?: number | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          artist_id?: string;
          source?: 'lastfm' | 'manual';
          playcount?: number | null;
          created_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          provider: string;
          external_id: string;
          artist_id: string;
          title: string;
          venue_name: string | null;
          city: string | null;
          country_code: string | null;
          lat: number | null;
          lng: number | null;
          starts_at: string | null;
          timezone: string | null;
          ticket_url: string;
          onsale_at: string | null;
          presales: Json;
          status: string;
          raw: Json;
          first_seen_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          external_id: string;
          artist_id: string;
          title: string;
          venue_name?: string | null;
          city?: string | null;
          country_code?: string | null;
          lat?: number | null;
          lng?: number | null;
          starts_at?: string | null;
          timezone?: string | null;
          ticket_url: string;
          onsale_at?: string | null;
          presales?: Json;
          status?: string;
          raw?: Json;
          first_seen_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          external_id?: string;
          artist_id?: string;
          title?: string;
          venue_name?: string | null;
          city?: string | null;
          country_code?: string | null;
          lat?: number | null;
          lng?: number | null;
          starts_at?: string | null;
          timezone?: string | null;
          ticket_url?: string;
          onsale_at?: string | null;
          presales?: Json;
          status?: string;
          raw?: Json;
          first_seen_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          kind: 'announced' | 'onsale_reminder';
          channel: 'telegram' | 'email';
          status: 'sent' | 'failed';
          error: string | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          kind: 'announced' | 'onsale_reminder';
          channel: 'telegram' | 'email';
          status?: 'sent' | 'failed';
          error?: string | null;
          sent_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          kind?: 'announced' | 'onsale_reminder';
          channel?: 'telegram' | 'email';
          status?: 'sent' | 'failed';
          error?: string | null;
          sent_at?: string;
        };
      };
      provider_health: {
        Row: {
          provider: string;
          last_success_at: string | null;
          last_error: string | null;
          last_error_at: string | null;
          consecutive_failures: number;
        };
        Insert: {
          provider: string;
          last_success_at?: string | null;
          last_error?: string | null;
          last_error_at?: string | null;
          consecutive_failures?: number;
        };
        Update: {
          provider?: string;
          last_success_at?: string | null;
          last_error?: string | null;
          last_error_at?: string | null;
          consecutive_failures?: number;
        };
      };
      telegram_link_tokens: {
        Row: {
          token: string;
          user_id: string;
          expires_at: string;
        };
        Insert: {
          token: string;
          user_id: string;
          expires_at: string;
        };
        Update: {
          token?: string;
          user_id?: string;
          expires_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      haversine_distance_km: {
        Args: {
          lat1: number;
          lng1: number;
          lat2: number;
          lng2: number;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
  };
}
