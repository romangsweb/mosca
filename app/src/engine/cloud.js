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

// ---------- tomas ----------
const META = 'id, name, created_at, bpm, dur_ms, steps, source, tracks, inputs, n_events';
const fromRow = (r) => ({ id: r.id, name: r.name, date: new Date(r.created_at).getTime(), bpm: r.bpm, durMs: r.dur_ms, steps: r.steps, source: r.source, tracks: r.tracks, inputs: r.inputs, events: r.events ?? null, nEvents: r.n_events ?? r.events?.length ?? 0 });
export async function listTakes() {
  const { data, error } = await cloud.from('takes').select(META).order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}
export async function getTake(id) {
  const { data, error } = await cloud.from('takes').select(`${META}, events`).eq('id', id).single();
  if (error) throw error;
  return fromRow(data);
}
// devuelve 'ok' | 'existe' | 'limite'
export async function uploadTake(t) {
  const { error } = await cloud.from('takes').insert({
    id: t.id, name: t.name.slice(0, 80), created_at: new Date(t.date).toISOString(), bpm: Math.round(t.bpm), dur_ms: Math.round(t.durMs),
    steps: t.steps || 0, source: t.source || null, tracks: t.tracks, inputs: t.inputs, events: t.events,
  });
  if (!error) return 'ok';
  if (error.code === '23505') return 'existe';
  if (error.code === 'P0001' || /limite_free/.test(error.message)) return 'limite';
  throw error;
}
export async function renameTakeCloud(id, name) { const { error } = await cloud.from('takes').update({ name: name.slice(0, 80) }).eq('id', id); if (error) throw error; }
export async function deleteTakeCloud(id) { const { error } = await cloud.from('takes').delete().eq('id', id); if (error) throw error; }
