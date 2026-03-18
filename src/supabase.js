import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jvesxkmlxpxpcilzqacz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_s91dPRcsTIQuevvG3V1leg_WzvHD70C';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
