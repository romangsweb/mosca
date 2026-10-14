import { useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { cloudEnabled, getPublicTake } from '../engine/cloud.js';
import { makeScene, W, H } from '../engine/video.js';
import { useS, Icon, Logo } from '../ui/kit.jsx';

// Página pública de una toma compartida: se escucha y se ve sin cuenta, y se puede abrir en tu propio estudio.
export default function Escuchar({ shareId }) {
  const s = useS(), cv = useRef(null), scene = useRef(null), raf = useRef(0), [take, setTake] = useState(null), [err, setErr] = useState(null), [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!cloudEnabled) { setErr('Esta versión de Fly Punch no tiene nube.'); return; }
    getPublicTake(shareId).then((t) => (t ? setTake(t) : setErr('Esta toma no existe o su autor dejó de compartirla.'))).catch(() => setErr('No pudimos cargar la toma. Revisa tu conexión.'));
    return () => { cancelAnimationFrame(raf.current); session.stopTake(); };
  }, [shareId]);
  useEffect(() => { if (take && s.ready && cv.current && !scene.current) { scene.current = makeScene(take, cv.current, { author: take.author }); scene.current.draw(0, 0); } }, [take, s.ready]);
  const play = () => {
    if (playing) { session.stopTake(); cancelAnimationFrame(raf.current); setPlaying(false); return; }
    scene.current.reset(); const t0 = performance.now() + 60; setPlaying(true);
    session.playTake(take, () => setPlaying(false), { kitOnly: true });
    const loop = (now) => { const t = now - t0; scene.current.draw(Math.max(0, t)); if (t < take.durMs + 1200) raf.current = requestAnimationFrame(loop); };
    raf.current = requestAnimationFrame(loop);
  };
  const remix = async () => { await session.importTake(take); location.hash = '#/tomas'; };
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 16px 32px', background: '#0B0B0C', color: '#ECECEE' }}>
      <a href="#/bienvenida" className="row" style={{ gap: 10, alignSelf: 'stretch', maxWidth: 520, margin: '0 auto', width: '100%' }}><Logo /><strong>Fly Punch</strong><span style={{ marginLeft: 'auto', fontSize: 12, color: '#8C8C94' }}>un cerebro real de mosca hace música</span></a>
      {err ? <p style={{ marginTop: 80, color: '#8C8C94' }}>{err}</p> : (
        <>
          <canvas ref={cv} width={W} height={H} style={{ width: 'min(520px, calc((100vh - 220px) * 0.5625))', aspectRatio: '9 / 16', borderRadius: 18, background: '#0E0E10', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }} aria-label={take ? `Toma «${take.name}»` : 'Cargando toma'} />
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn lg acc" disabled={!take || !s.ready} onClick={play}><Icon name={playing ? 'stop' : 'play'} size={13} fill="currentColor" />{playing ? 'Detener' : take ? 'Escuchar' : 'Cargando…'}</button>
            <button type="button" className="btn lg" disabled={!take} onClick={remix} style={{ color: '#ECECEE', borderColor: 'rgba(255,255,255,.18)' }}><Icon name="estudio" size={13} />Abrir en mi estudio</button>
          </div>
          <p style={{ margin: 0, maxWidth: 520, fontSize: 12.5, lineHeight: 1.55, color: '#8C8C94', textAlign: 'center' }}>Cada golpe lo disparó una neurona real del conectoma FlyWire, simulada con el modelo de Shiu et al. (2024). <a href="#/bienvenida" style={{ color: '#FF6A1A' }}>Crea la tuya →</a></p>
        </>
      )}
    </div>
  );
}
