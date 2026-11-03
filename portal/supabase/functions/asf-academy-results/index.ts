import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { createHandler } from './handler.mjs';
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const admin = createClient(Deno.env.get('SUPABASE_URL') || '', service, { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(createHandler({ admin, salt: service }));
