import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pkloymdzdjykpsutpyqk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_x7puqG5DzU9YkvDsV10HyQ_144KlMqt';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
