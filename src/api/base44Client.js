import { createClient } from '@supabase/supabase-js';
import entities from './entities';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Auth helpers that match the Base44 API shape
const auth = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw error || new Error('Not authenticated');
    const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
    return { ...user, ...profile, full_name: user.user_metadata?.full_name || user.email };
  },
  async logout(redirectUrl) {
    await supabase.auth.signOut();
    if (redirectUrl) window.location.href = redirectUrl;
  },
  async isAuthenticated() {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  },
  redirectToLogin(returnUrl) {
    window.location.href = `/login?next=${encodeURIComponent(returnUrl || '/')}`;
  },
};

// Functions stub — cloud functions will be replaced by Edge Functions
const functions = {
  async invoke(name, payload) {
    const { data, error } = await supabase.functions.invoke(name, { body: payload });
    if (error) throw error;
    return data;
  },
};

// Drop-in replacement for the old `base44` object
export const base44 = { entities, auth, functions };
