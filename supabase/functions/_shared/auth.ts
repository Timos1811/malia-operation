import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export type AuthedUser = {
  id: string;
  email: string | null;
  role: string;
  status: string;
  full_name: string | null;
};

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

export async function authenticate(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing authorization header');
  }
  const token = authHeader.slice(7);

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  );
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    throw new HttpError(401, 'Invalid token');
  }

  const svc = serviceClient();
  const { data: profile, error: profErr } = await svc
    .from('users')
    .select('id, role, status, full_name')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profErr) throw new HttpError(500, 'Profile lookup failed');
  if (!profile) throw new HttpError(403, 'No profile');
  if (profile.status !== 'approved') {
    throw new HttpError(403, 'Account not approved');
  }

  return {
    id: profile.id,
    email: userData.user.email ?? null,
    role: profile.role,
    status: profile.status,
    full_name: profile.full_name ?? userData.user.user_metadata?.full_name ?? null,
  };
}

export function requireAdmin(user: AuthedUser): void {
  if (user.role !== 'admin') {
    throw new HttpError(403, 'Admin access required');
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return jsonResponse({ error: err.message }, err.status);
  }
  console.error('Edge function error:', err);
  return jsonResponse({ error: 'Internal error' }, 500);
}
