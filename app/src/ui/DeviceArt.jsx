const A = '#FF6A1A';
// Miniaturas propias, genéricas (no son réplicas de ningún producto): solo el tipo de aparato.
const ART = {
  bolsillo: <><rect x="34" y="8" width="52" height="64" rx="4" /><rect x="40" y="14" width="22" height="9" rx="1.5" /><circle cx="73" cy="18" r="4" /><circle cx="80" cy="18" r="2.5" />{[0, 1, 2, 3].flatMap((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={41 + c * 13.5} y={29 + r * 10.5} width="11" height="8" rx="1.5" fill={r === 0 && c === 2 ? A : 'none'} stroke={r === 0 && c === 2 ? A : 'currentColor'} />))}</>,
  ritmos: <><rect x="8" y="16" width="104" height="48" rx="4" /><rect x="14" y="22" width="20" height="8" rx="1.5" />{[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={46 + i * 11} cy="26" r="3.6" />)}{Array.from({ length: 16 }, (_, i) => <rect key={i} x={13 + i * 6.2} y="48" width="4.6" height="8" rx="1" fill={i % 4 === 0 ? A : 'none'} stroke={i % 4 === 0 ? A : 'currentColor'} />)}</>,
  groovebox: <><rect x="16" y="10" width="88" height="60" rx="4" /><rect x="40" y="16" width="40" height="14" rx="2" />{[0, 1, 2, 3].map((i) => <circle key={i} cx={30 + i * 20} cy="38" r="3.4" />)}{Array.from({ length: 8 }, (_, i) => <rect key={i} x={22 + i * 10} y="50" width="7" height="12" rx="1.5" fill={i === 2 ? A : 'none'} stroke={i === 2 ? A : 'currentColor'} />)}</>,
  software: <><rect x="20" y="10" width="80" height="50" rx="3" /><path d="M10 66h100l-6 6H16z" />{[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={40 + c * 10.5} y={16 + r * 10.5} width="8" height="8" rx="1" fill={r === 3 && c === 0 ? A : 'none'} stroke={r === 3 && c === 0 ? A : 'currentColor'} />))}</>,
  teclado: <><rect x="8" y="18" width="104" height="44" rx="4" />{[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={20 + i * 12} cy="28" r="3.4" />)}<rect x="82" y="23" width="22" height="9" rx="1.5" />{Array.from({ length: 14 }, (_, i) => <rect key={i} x={13 + i * 6.7} y="40" width="6.2" height="18" rx="0.8" fill={i === 5 ? A : 'none'} stroke={i === 5 ? A : 'currentColor'} />)}</>,
  personal: <>{[0, 1, 2, 3].map((i) => <g key={i}><line x1={34 + i * 17} y1="14" x2={34 + i * 17} y2="66" /><rect x={29 + i * 17} y={[44, 22, 52, 32][i]} width="10" height="7" rx="1.5" fill={i === 1 ? A : '#08080A'} stroke={i === 1 ? A : 'currentColor'} /></g>)}</>,
  interno: <><path d="M40 30h12l16-12v44L52 50H40z" /><path d="M76 30a14 14 0 0 1 0 20M82 24a22 22 0 0 1 0 32" stroke={A} /></>,
};
export function DeviceArt({ art, size = 120 }) {
  return <svg viewBox="0 0 120 80" width={size} height={(size * 2) / 3} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ART[art]}</svg>;
}

