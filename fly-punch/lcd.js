// Fly Punch · pantalla LCD monocromática de 128×64, gráficos propios.
const F = { // tipografía 3×5
  '0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001',
  '5':'111100111001111','6':'111100111101111','7':'111001001001001','8':'111101111101111','9':'111101111001111',
  A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',
  G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',
  M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110101101',
  S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',
  Y:'101101010010010',Z:'111001010100111',' ':'000000000000000','.':'000000000000010',':':'000010000010000',
  '-':'000000111000000','/':'001001010100100','%':'101001010100101','>':'100010001010100'
};
const FLY = [ // dos cuadros: alas arriba / alas abajo (15×11)
  ['...............','.##.........##.','#..#.......#..#','#...#.###.#...#','.#...#####...#.','..###.###.###..','.....#####.....','.....#####.....','......###......','......###......','.......#.......'],
  ['...............','...............','......###......','.....#####.....','..###.###.###..','.#...#####...#.','#...#.###.#...#','#..#.#####.#..#','.##...###...##.','......###......','.......#.......'],
];
export class LCD {
  constructor(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d'); this.W = 128; this.H = 64;
    canvas.width = this.W; canvas.height = this.H;
    this.spark = new Array(84).fill(0); this.msg = ''; this.msgUntil = 0; this.frame = 0; this.boot = performance.now();
  }
  px(x, y) { this.x.fillRect(x, y, 1, 1); }
  text(s, x, y, k = 1) {
    for (const ch of String(s).toUpperCase()) {
      const gl = F[ch] ?? F[' '];
      for (let i = 0; i < 15; i++) if (gl[i] === '1') this.x.fillRect(x + (i % 3) * k, y + Math.floor(i / 3) * k, k, k);
      x += 4 * k;
    }
    return x;
  }
  bar(x, y, w, h, f) {
    this.x.fillRect(x, y, 1, h); this.x.fillRect(x + w - 1, y, 1, h);
    const n = Math.round((w - 4) * Math.max(0, Math.min(1, f)));
    for (let i = 0; i < n; i += 2) this.x.fillRect(x + 2 + i, y + 1, 1, h - 2);
  }
  say(m, ms = 1400) { this.msg = m; this.msgUntil = performance.now() + ms; }
  push(active) { this.spark.push(active); this.spark.shift(); this.frame++; }
  draw(s) {
    const x = this.x, ON = '#E6EED6';
    x.fillStyle = '#10130F'; x.fillRect(0, 0, this.W, this.H); x.fillStyle = ON;
    const t = performance.now() - this.boot;
    if (t < 1600) { // arranque
      const n = Math.floor(t / 90);
      this.text('FLY PUNCH'.slice(0, n), 28, 22, 2);
      if (t > 900) this.text('PESO MOSCA', 44, 42);
      return;
    }
    this.text('FLY PUNCH', 2, 2); this.text(s.running ? '>' : '.', 44, 2);
    this.text(`${Math.round(s.bpm)} BPM`, 128 - 4 * (`${Math.round(s.bpm)} BPM`.length) - 2, 2);
    x.fillRect(0, 9, 128, 1);
    // mosca (2×), alas al ritmo; probóscide afuera si MN9 está activa
    const fr = FLY[s.running ? this.frame % 2 : 0];
    for (let r = 0; r < 11; r++) for (let c = 0; c < 15; c++) if (fr[r][c] === '#') x.fillRect(4 + c * 2, 13 + r * 2, 2, 2);
    if (s.mn9 > 20) { x.fillRect(4 + 7 * 2, 13 - 2, 2, 2); x.fillRect(4 + 7 * 2, 13 - 4, 2, 2); }
    if (s.sugar > 0 && s.running && this.frame % 4 < 2) x.fillRect(4 + 7 * 2, 13 - 8, 2, 2); // gota de azúcar
    // lecturas
    this.text(`AZUCAR ${String(s.sugar).padStart(3)}`, 40, 13); this.bar(98, 13, 28, 5, s.sugar / 200);
    this.text(`MN9   ${String(Math.round(s.mn9)).padStart(3)}`, 40, 21); this.bar(98, 21, 28, 5, s.mn9 / 71);
    const line = performance.now() < this.msgUntil ? this.msg : `ACT ${String(s.active).padStart(3)}/356`;
    this.text(line.slice(0, 22), 40, 29);
    this.text(s.clock === 'ext' ? 'SYNC K.O.' : 'RELOJ INT', 40, 37);
    // actividad: barras por semicorchea
    x.fillRect(0, 46, 128, 1);
    const mx = Math.max(20, ...this.spark);
    this.text('ACTIVIDAD', 2, 50); this.text('356 N', 2, 57);
    this.spark.forEach((v, i) => { const h = Math.round(v / mx * 14); x.fillRect(42 + i, 62 - h, 1, h); });
  }
}
