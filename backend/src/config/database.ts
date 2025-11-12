import { createClient, SupabaseClient } from '@supabase/supabase-js';
import logger from '../utils/logger';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing Supabase configuration. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
  );
}

// Service role client (bypasses RLS - use with caution)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Anon client for public operations
export const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

logger.info('Supabase client initialized');
