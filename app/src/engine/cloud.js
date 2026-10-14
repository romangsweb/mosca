// Fly Punch · cuenta en la nube (Supabase). Si no hay variables de entorno, la app sigue 100 % local.
// VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY son públicas por diseño: la seguridad la dan las políticas RLS.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL, KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloud = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }) : null;
export const cloudEnabled = !!cloud;

const redirectTo = () => `${location.origin}${location.pathname}`;

export async function signInGoogle() {
  const { error } = await cloud.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
  if (error) throw error;
}
export async function signInEmail(email) {
  const { error } = await cloud.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  if (error) throw error;
}
export async function signOut() { await cloud.auth.signOut(); }
export async function currentUser() { const { data } = await cloud.auth.getSession(); return data.session?.user || null; }
export function onAuth(fn) { const { data } = cloud.auth.onAuthStateChange((_e, s) => fn(s?.user || null)); return () => data.subscription.unsubscribe(); }

export async function loadProfile(uid) {
  const { data, error } = await cloud.from('profiles').select('alias, plan, settings, updated_at').eq('id', uid).maybeSingle();
  if (error) throw error;
  return data;
}
export async function saveProfile(uid, patch) {
  const { error } = await cloud.from('profiles').update(patch).eq('id', uid);
  if (error) throw error;
}
