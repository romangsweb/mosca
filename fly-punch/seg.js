// Fly Punch · dígitos de 7 segmentos; los segmentos apagados siempre se ven tenues, como en una pantalla real.
const R = { a: [4, 1, 12, 3], b: [16, 4, 3, 12], c: [16, 18, 3, 12], d: [4, 30, 12, 3], e: [1, 18, 3, 12], f: [1, 4, 3, 12], g: [4, 15.5, 12, 3] };
const MAP = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcfgd', '-': 'g', ' ': '' };
export function seg(text, n = String(text).length) {
  const s = String(text).padStart(n, ' ').slice(-n); let out = '';
  [...s].forEach((ch, k) => {
    const on = MAP[ch] ?? '';
    for (const [id, [x, y, w, h]] of Object.entries(R)) out += `<rect x="${x + k * 23}" y="${y}" width="${w}" height="${h}" rx="1.2" class="${on.includes(id) ? 'on' : 'off'}"/>`;
  });
  return `<svg viewBox="-1 0 ${n * 23} 34" class="seg" aria-hidden="true"><g transform="skewX(-7)">${out}</g></svg>`;
}
