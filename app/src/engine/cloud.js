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
  // con el estado de la suscripción (migración 0006); si aún no existe, sin él
  let { data, error } = await cloud.from('profiles').select('alias, plan, settings, updated_at, trial_ends_at, trial_used, plan_status, plan_cycle, plan_renews_at, plan_cancel_at, paddle_subscription_id').eq('id', uid).maybeSingle();
  if (error) ({ data, error } = await cloud.from('profiles').select('alias, plan, settings, updated_at, trial_ends_at, trial_used').eq('id', uid).maybeSingle());
  if (error) throw error;
  return data;
}
export async function saveProfile(uid, patch) {
  const { error } = await cloud.from('profiles').update(patch).eq('id', uid);
  if (error) throw error;
}

export async function startTrialCloud() {
  const { data, error } = await cloud.rpc('start_trial');
  if (error) throw error;
  return new Date(data).getTime();
}

// ---------- tomas ----------
const META = 'id, name, created_at, bpm, dur_ms, steps, source, tracks, inputs, n_events';
const fromRow = (r) => ({ id: r.id, name: r.name, date: new Date(r.created_at).getTime(), bpm: r.bpm, durMs: r.dur_ms, steps: r.steps, compas: r.compas || '4/4', cloudAudio: !!r.has_audio, source: r.source, tracks: r.tracks, inputs: r.inputs, events: r.events ?? null, nEvents: r.n_events ?? r.events?.length ?? 0 });
export async function listTakes() {
  // con las columnas de compartir (migración 0004); si aún no existen, sin ellas
  // con las columnas de las migraciones 0004 (compartir) y 0005 (compás, audio); si aún no existen, sin ellas
  let r = await cloud.from('takes').select(`${META}, public, share_id, compas, has_audio`).order('created_at', { ascending: false });
  if (r.error) r = await cloud.from('takes').select(`${META}, public, share_id`).order('created_at', { ascending: false });
  if (r.error) r = await cloud.from('takes').select(META).order('created_at', { ascending: false });
  if (r.error) throw r.error;
  return r.data.map((x) => ({ ...fromRow(x), shared: !!x.public, shareId: x.share_id || null }));
}
// ---------- compartir ----------
const slugId = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
export async function shareTake(id, author = '', existing = null) {
  const share_id = existing || slugId(); // el mismo enlace si ya se había compartido
  const { data, error } = await cloud.from('takes').update({ public: true, share_id, author: author.slice(0, 40) || null }).eq('id', id).select('share_id').single();
  if (error) throw error;
  return data.share_id;
}
export async function unshareTake(id) { const { error } = await cloud.from('takes').update({ public: false }).eq('id', id); if (error) throw error; }
export async function getPublicTake(shareId) {
  let { data, error } = await cloud.from('takes').select('id, name, created_at, bpm, dur_ms, steps, tracks, inputs, events, author, compas').eq('share_id', shareId).eq('public', true).maybeSingle();
  if (error) ({ data, error } = await cloud.from('takes').select('id, name, created_at, bpm, dur_ms, steps, tracks, inputs, events, author').eq('share_id', shareId).eq('public', true).maybeSingle());
  if (error) throw error;
  return data && { ...fromRow(data), author: data.author };
}
// enlace corto /t/<id>: en Cloudflare una función le da a las redes título e imagen (vista previa) y redirige a /#/t/<id>
export const shareUrl = (shareId) => `${location.origin}/t/${shareId}`;
export async function getTake(id) {
  const { data, error } = await cloud.from('takes').select(`${META}, events`).eq('id', id).single();
  if (error) throw error;
  return fromRow(data);
}
// devuelve 'ok' | 'existe' | 'limite'
export async function uploadTake(t) {
  const row = {
    id: t.id, name: t.name.slice(0, 80), created_at: new Date(t.date).toISOString(), bpm: Math.round(t.bpm), dur_ms: Math.round(t.durMs),
    steps: t.steps || 0, source: t.source || null, tracks: t.tracks, inputs: t.inputs, events: t.events,
  };
  let { error } = await cloud.from('takes').insert({ ...row, compas: t.compas || '4/4' });
  if (error && (error.code === 'PGRST204' || /compas/.test(error.message))) ({ error } = await cloud.from('takes').insert(row)); // sin la migración 0005
  if (!error) return 'ok';
  if (error.code === '23505') return 'existe';
  if (error.code === 'P0001' || /limite_free/.test(error.message)) return 'limite';
  throw error;
}
export async function renameTakeCloud(id, name) { const { error } = await cloud.from('takes').update({ name: name.slice(0, 80) }).eq('id', id); if (error) throw error; }
export async function deleteTakeCloud(id) { const { error } = await cloud.from('takes').delete().eq('id', id); if (error) throw error; }

// ---------- archivos: «Mi kit» y audio real de las tomas (migración 0005) ----------
// rutas: <uid>/kit/<voz> (+ <uid>/kit/indice.json con los nombres originales) y <uid>/tomas/<id>
const vozPath = (uid, voice) => `${uid}/kit/${voice.replace(/\s+/g, '_')}`;
const indicePath = (uid) => `${uid}/kit/indice.json`;
export async function kitIndex(uid) {
  const { data, error } = await cloud.storage.from('muestras').download(indicePath(uid));
  if (error) { if (/not.?found|404|Object not found/i.test(error.message || '') || error.statusCode === '404' || error.status === 400) return {}; throw error; }
  try { return JSON.parse(await data.text()) || {}; } catch { return {}; }
}
async function saveIndex(uid, idx) {
  const { error } = await cloud.storage.from('muestras').upload(indicePath(uid), new Blob([JSON.stringify(idx)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' });
  if (error) throw error;
}
export async function uploadSample(uid, voice, name, data, type = 'audio/wav') {
  const { error } = await cloud.storage.from('muestras').upload(vozPath(uid, voice), new Blob([data], { type }), { upsert: true, contentType: type.startsWith('audio/') ? type : 'audio/wav' });
  if (error) throw error;
  const idx = await kitIndex(uid); idx[voice] = { name, at: Date.now() }; await saveIndex(uid, idx);
}
export async function downloadSample(uid, voice) {
  const { data, error } = await cloud.storage.from('muestras').download(vozPath(uid, voice));
  if (error) throw error; return data.arrayBuffer();
}
export async function deleteSample(uid, voice) {
  await cloud.storage.from('muestras').remove([vozPath(uid, voice)]);
  const idx = await kitIndex(uid); delete idx[voice]; await saveIndex(uid, idx);
}
const audioPath = (uid, id) => `${uid}/tomas/${id}`;
export async function uploadTakeAudio(uid, id, blob) {
  const { error } = await cloud.storage.from('audio-tomas').upload(audioPath(uid, id), blob, { upsert: true, contentType: blob.type || 'audio/webm' });
  if (error) throw error;
  await cloud.from('takes').update({ has_audio: true }).eq('id', id);
}
export async function downloadTakeAudio(uid, id) {
  const { data, error } = await cloud.storage.from('audio-tomas').download(audioPath(uid, id));
  if (error) return null; return data;
}
export async function deleteTakeAudio(uid, id) { await cloud.storage.from('audio-tomas').remove([audioPath(uid, id)]); }
