import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl: string = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  'https://pkloymdzdjykpsutpyqk.supabase.co';

const supabaseAnonKey: string = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  'sb_publishable_x7puqG5DzU9YkvDsV10HyQ_144KlMqt';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

