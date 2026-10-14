// Fly Punch · guardado local (IndexedDB). Más adelante se sincroniza con la cuenta.
const DB = 'flypunch', VER = 2;
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    // si otra pestaña con una versión vieja tiene la base abierta, la actualización queda bloqueada: no esperamos para siempre
    const timer = setTimeout(() => { dbp = null; rej(new Error('indexeddb bloqueada: cierra otras pestañas de Fly Punch')); }, 3000);
    r.onblocked = () => console.warn('Fly Punch: cierra las otras pestañas de la app para actualizar el guardado local');
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('takes')) d.createObjectStore('takes', { keyPath: 'id' }); if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if (!d.objectStoreNames.contains('samples')) d.createObjectStore('samples'); };
    r.onsuccess = () => { clearTimeout(timer); const d = r.result; d.onversionchange = () => { d.close(); dbp = null; }; res(d); };
    r.onerror = () => { clearTimeout(timer); dbp = null; rej(r.error); };
  });
  return dbp;
}
const tx = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store), out = fn(s); const to = setTimeout(() => rej(new Error('indexeddb lenta')), 4000); t.oncomplete = () => { clearTimeout(to); res(out?.result ?? out); }; t.onerror = () => { clearTimeout(to); rej(t.error); }; }); };

export const kvGet = (k) => tx('kv', 'readonly', (s) => s.get(k)).catch(() => undefined);
export const kvSet = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k)).catch(() => undefined);
export const takesAll = () => tx('takes', 'readonly', (s) => s.getAll()).then((a) => (a || []).sort((x, y) => y.date - x.date)).catch((e) => { console.warn('tomas locales', e); return []; });
export const takePut = (t) => tx('takes', 'readwrite', (s) => s.put(t)).catch((e) => console.warn('guardar toma', e));
export const takeDel = (id) => tx('takes', 'readwrite', (s) => s.delete(id)).catch((e) => console.warn('borrar toma', e));
export const FREE_TAKES = 5;
// muestras propias por sonido (Mi kit): { name, data: ArrayBuffer }
export const sampleGet = (voice) => tx('samples', 'readonly', (s) => s.get(voice)).catch(() => undefined);
export const samplePut = (voice, v) => tx('samples', 'readwrite', (s) => s.put(v, voice));
export const sampleDel = (voice) => tx('samples', 'readwrite', (s) => s.delete(voice));
