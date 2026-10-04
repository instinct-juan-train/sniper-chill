// @ts-nocheck
import * as THREE from './three.module.min.js';

const RAW = [
'############################',
'#..........#...............#',
'#..AA......#......cc.......#',
'#..AA..cc..#...............#',
'#......cc..........##......#',
'#..........#........#......#',
'######..#####..............#',
'#..........................#',
'#....cc............cc..BB..#',
'#....cc............cc..BB..#',
'#..........####............#',
'#..........#..#...........#',
'#...cc.....#..#.....cc.....#',
'#...cc.....####.....cc.....#',
'#..........................#',
'#####..######......#####..##',
'#..........................#',
'#..P.......................#',
'#..........................#',
'#.....cc...........cc......#',
'#.....cc...........cc......#',
'############################'];
const W = 28, H = RAW.length, T = 2, WALL_H = 4, CRATE_H = 1.3, EYE = 1.65;
const MAP = RAW.map((r) => (r + '.'.repeat(W)).slice(0, W));
const solid = (tx, tz) => tx < 0 || tz < 0 || tx >= W || tz >= H || MAP[tz][tx] === '#' || MAP[tz][tx] === 'c';
const blocked = (x, z, r) => solid(Math.floor((x + r) / T), Math.floor((z + r) / T)) || solid(Math.floor((x - r) / T), Math.floor((z + r) / T)) || solid(Math.floor((x + r) / T), Math.floor((z - r) / T)) || solid(Math.floor((x - r) / T), Math.floor((z - r) / T));
function tilesOf(ch) { const a = []; for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (MAP[z][x] === ch) a.push([x, z]); return a; }
const centre = (ch) => { const t = tilesOf(ch); const sx = t.reduce((s, p) => s + p[0], 0) / t.length, sz = t.reduce((s, p) => s + p[1], 0) / t.length; return new THREE.Vector3((sx + 0.5) * T, 0, (sz + 0.5) * T); };
const SITES = { A: centre('A'), B: centre('B') };
const SPAWN = (() => { const p = tilesOf('P')[0]; return new THREE.Vector3((p[0] + 0.5) * T, 0, (p[1] + 0.5) * T); })();
const BOT_SPOTS = [[4, 3], [9, 4], [24, 8], [18, 4], [14, 12], [22, 13], [6, 11]];

function flow(tx, tz) {
  const d = new Int16Array(W * H).fill(-1); const q = [[tx, tz]]; d[tz * W + tx] = 0;
  for (let i = 0; i < q.length; i++) { const [x, z] = q[i]; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (!solid(nx, nz) && d[nz * W + nx] < 0) { d[nz * W + nx] = d[z * W + x] + 1; q.push([nx, nz]); } } }
  return d;
}
function nextStep(d, px, pz) {
  const tx = Math.floor(px / T), tz = Math.floor(pz / T); let best = null, bv = d[tz * W + tx];
  if (bv < 0) return null;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = tx + dx, nz = tz + dz; if (solid(nx, nz)) continue; const v = d[nz * W + nx]; if (v >= 0 && v < bv) { bv = v; best = [(nx + 0.5) * T, (nz + 0.5) * T]; } }
  return best;
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const WEAPONS = [
  { name: 'Pistola', dmg: 28, rate: 0.26, mag: 12, spread: 0.008, reload: 1.2, auto: false, kick: 0.012 },
  { name: 'Ametralladora', dmg: 12, rate: 0.085, mag: 30, spread: 0.03, reload: 1.7, auto: true, kick: 0.007 },
  { name: 'Sniper', dmg: 100, rate: 1.1, mag: 5, spread: 0.07, reload: 2.4, auto: false, kick: 0.05, scope: true },
];

const CSS = `
.sg{position:relative;width:100%;aspect-ratio:16/9;background:#bfe3ff;overflow:hidden;border-radius:12px;font-family:system-ui,sans-serif;color:#fff;user-select:none;-webkit-user-select:none}
.sg canvas.main{width:100%;height:100%;display:block}
.sg .ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(20,30,45,.72);text-align:center;padding:16px;z-index:5}
.sg .ov h2{margin:0;font-size:clamp(20px,4vw,38px)}
.sg .ov p{margin:0;font-size:clamp(11px,1.5vw,15px);opacity:.9;max-width:640px;line-height:1.4}
.sg button{font:inherit;font-weight:700;padding:10px 18px;border-radius:10px;border:0;background:#ffd166;color:#222;cursor:pointer;min-height:44px}
.sg button.alt{background:#9ad1ff}
.sg .hud{position:absolute;inset:0;pointer-events:none;font-weight:700;text-shadow:0 1px 3px #0008}
.sg .xh{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px}
.sg .xh:before,.sg .xh:after{content:'';position:absolute;background:#fff;box-shadow:0 0 2px #000}
.sg .xh:before{left:8px;top:0;width:2px;height:18px}.sg .xh:after{top:8px;left:0;height:2px;width:18px}
.sg .xh.hit:before,.sg .xh.hit:after{background:#ff4d4d}
.sg .bl{position:absolute;left:12px;bottom:12px;width:min(32%,230px)}
.sg .hb{height:14px;background:#0006;border-radius:7px;overflow:hidden}.sg .hb i{display:block;height:100%;background:#5fe08a;width:100%}
.sg .br{position:absolute;right:12px;bottom:12px;text-align:right;font-size:clamp(12px,2vw,20px)}
.sg .tp{position:absolute;top:10px;left:50%;transform:translateX(-50%);text-align:center;font-size:clamp(12px,2vw,20px);background:#0005;padding:4px 12px;border-radius:10px;white-space:nowrap}
.sg .kf{position:absolute;right:10px;top:10px;text-align:right;font-size:clamp(10px,1.4vw,14px)}
.sg .pr{position:absolute;left:50%;top:62%;transform:translateX(-50%);text-align:center;font-size:clamp(12px,1.8vw,18px);background:#0006;padding:6px 14px;border-radius:10px}
.sg .pb{width:180px;height:10px;background:#0006;border-radius:5px;margin:6px auto 0;overflow:hidden}.sg .pb i{display:block;height:100%;width:0;background:#ffd166}
.sg .dm{position:absolute;inset:0;background:radial-gradient(transparent 40%,rgba(255,0,0,.6));opacity:0}
.sg .sc{position:absolute;inset:0;display:none;background:radial-gradient(circle at 50% 50%,transparent 0,transparent 27%,#000 28%)}
.sg .sc:before{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:#000}.sg .sc:after{content:'';position:absolute;top:0;bottom:0;left:50%;width:1px;background:#000}
.sg .hs{position:absolute;left:50%;top:40%;transform:translateX(-50%);color:#ff5a5a;font-size:clamp(14px,2.5vw,26px);opacity:0}
.sg canvas.mm{position:absolute;left:10px;top:10px;width:110px;height:88px;background:#0004;border-radius:8px}
.sg .fs{position:absolute;right:10px;bottom:56px;pointer-events:auto;min-height:34px;padding:4px 10px;font-size:12px;z-index:4;opacity:.8}
`;

class Bot {
  constructor(g, x, z, dummy) {
    this.g = g; this.dummy = dummy; this.hp = dummy ? 40 : 100; this.maxhp = this.hp; this.dead = false; this.cool = 1; this.aimT = 0; this.alert = false; this.los = false; this.losT = Math.random() * 0.3; this.fall = 0; this.life = 0; this.hurt = 0;
    this.pos = new THREE.Vector3(x, 0, z); this.group = new THREE.Group();
    const col = dummy ? 0xff9f43 : 0x4a5d8f;
    const mat = new THREE.MeshLambertMaterial({ color: col }), skin = new THREE.MeshLambertMaterial({ color: 0xf2c9a0 });
    this.legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), new THREE.MeshLambertMaterial({ color: dummy ? 0xd9822b : 0x2f3b5e })); this.legs.position.y = 0.4;
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), mat); this.torso.position.y = 1.2;
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin); this.head.position.y = 1.62;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 })); gun.position.set(0.3, 1.25, 0.3);
    this.legs.userData = this.torso.userData = { bot: this, part: 'body' }; this.head.userData = { bot: this, part: 'head' };
    this.group.add(this.legs, this.torso, this.head, gun); this.parts = [this.legs, this.torso, this.head];
    this.bar = new THREE.Group(); const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.1), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    this.fill = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.07), new THREE.MeshBasicMaterial({ color: 0x5fe08a })); this.fill.position.z = 0.002; this.bar.add(bg, this.fill);
    g.scene.add(this.group, this.bar); this.sync();
  }
  eye() { return new THREE.Vector3(this.pos.x, 1.55, this.pos.z); }
  sync() { this.group.position.copy(this.pos); this.bar.position.set(this.pos.x, 2.1, this.pos.z); this.bar.lookAt(this.g.camera.position); this.fill.scale.x = Math.max(0.001, this.hp / this.maxhp); this.fill.position.x = -0.4 * (1 - this.hp / this.maxhp); this.fill.material.color.set(this.hp > 50 ? 0x5fe08a : this.hp > 25 ? 0xffd166 : 0xff5a5a); }
  damage(n, head) {
    if (this.dead) return; this.hp -= head ? 999 : n; this.alert = true; this.hurt = 3;
    if (this.hp <= 0) { this.dead = true; this.hp = 0; this.bar.visible = false; this.fall = 0; this.g.onKill(this, head); } this.sync();
  }
  remove() { this.g.scene.remove(this.group, this.bar); }
  move(tx, tz, dt, sp) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz); if (d < 0.05) return;
    const s = Math.min(d, sp * dt); const mx = dx / d * s, mz = dz / d * s;
    if (!blocked(this.pos.x + mx, this.pos.z, 0.35)) this.pos.x += mx; if (!blocked(this.pos.x, this.pos.z + mz, 0.35)) this.pos.z += mz;
  }
  update(dt) {
    const g = this.g;
    if (this.dead) { this.fall += dt; this.group.rotation.x = -Math.min(1.5, this.fall * 4); if (this.fall > 3) { this.remove(); this.gone = true; } return; }
    if (this.dummy) { this.life += dt; this.group.rotation.y = Math.atan2(g.pos.x - this.pos.x, g.pos.z - this.pos.z); this.sync(); return; }
    const p = g.pos, dx = p.x - this.pos.x, dz = p.z - this.pos.z, dist = Math.hypot(dx, dz);
    this.losT -= dt; if (this.losT <= 0) { this.losT = 0.2; this.los = g.alive && dist < 32 && g.los(this.eye(), new THREE.Vector3(p.x, g.eyeY(), p.z)); }
    this.hurt = Math.max(0, this.hurt - dt);
    const defusing = g.bomb.planted && g.defuser === this && this.hurt <= 0 && !(this.los && dist < 9);
    if (defusing) {
      this.alert = true; const b = g.bomb.pos;
      if (Math.hypot(b.x - this.pos.x, b.z - this.pos.z) < 1.6) { g.defuseT += dt; this.group.rotation.y += dt * 3; } else { const s = nextStep(g.fBomb, this.pos.x, this.pos.z); if (s) this.move(s[0], s[1], dt, 3.6); else this.move(b.x, b.z, dt, 3.6); this.group.rotation.y = Math.atan2(b.x - this.pos.x, b.z - this.pos.z); }
    } else if (this.los) {
      this.alert = true; this.group.rotation.y = Math.atan2(dx, dz); this.aimT += dt; this.cool -= dt;
      if (dist > 14) { this.move(p.x, p.z, dt, 1.6); } else this.move(this.pos.x + Math.cos(g.time * 1.3 + this.maxhp) * 0.5, this.pos.z, dt, 0.8);
      if (this.aimT > 0.8 && this.cool <= 0) { this.cool = 0.75 + Math.random() * 0.6; g.botShoot(this, dist); }
    } else {
      this.aimT = 0;
      if (this.alert && g.alive) { const s = nextStep(g.fPlayer, this.pos.x, this.pos.z); if (s) { this.move(s[0], s[1], dt, 3); this.group.rotation.y = Math.atan2(s[0] - this.pos.x, s[1] - this.pos.z); } }
      else this.group.rotation.y += Math.sin(g.time * 0.7 + this.maxhp * 3) * dt * 0.8;
    }
    this.sync();
  }
}

export class Game {
  constructor(root) {
    this.root = root; if (!document.getElementById('sg-css')) { const s = document.createElement('style'); s.id = 'sg-css'; s.textContent = CSS; document.head.appendChild(s); }
    root.classList.add('sg');
    this.canvas = document.createElement('canvas'); this.canvas.className = 'main'; root.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xbfe3ff); this.scene.fog = new THREE.Fog(0xbfe3ff, 18, 60);
    this.camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 100); this.camera.rotation.order = 'YXZ'; this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8a98a, 1.0)); const sun = new THREE.DirectionalLight(0xfff1d6, 1.1); sun.position.set(20, 40, 10); this.scene.add(sun);
    this.buildMap(); this.buildViewmodel(); this.buildHud();
    this.raycaster = new THREE.Raycaster(); this.keys = {}; this.mouseDown = false; this.rmb = false; this.fx = [];
    this.state = 'menu'; this.pos = SPAWN.clone(); this.yaw = 0; this.pitch = 0; this.time = 0; this.bots = []; this.alive = false; this.lock = 'none';
    this.bindEvents(); this.resize(); this.last = performance.now(); this.running = true; this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
    this.showMenu();
  }
  buildMap() {
    const floorTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#ecdcb8'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#e2d0a6'; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(W / 2, H / 2); t.magFilter = THREE.NearestFilter; return t; })();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * T, H * T), new THREE.MeshLambertMaterial({ map: floorTex })); floor.rotation.x = -Math.PI / 2; floor.position.set(W * T / 2, 0, H * T / 2); this.scene.add(floor);
    this.solids = [floor]; const wg = new THREE.BoxGeometry(T, WALL_H, T), cg = new THREE.BoxGeometry(T, CRATE_H, T);
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const c = MAP[z][x]; if (c !== '#' && c !== 'c') continue;
      const m = new THREE.Mesh(c === '#' ? wg : cg, new THREE.MeshLambertMaterial({ color: c === '#' ? new THREE.Color().setHSL(0.58 + ((x * 7 + z * 3) % 5) * 0.012, 0.28, 0.62) : new THREE.Color().setHSL(0.08, 0.55, 0.5 + ((x + z) % 3) * 0.04) }));
      m.position.set((x + 0.5) * T, (c === '#' ? WALL_H : CRATE_H) / 2, (z + 0.5) * T); this.scene.add(m); this.solids.push(m);
    }
    const label = (txt, col) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.font = 'bold 100px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(txt, 64, 70); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.scale.set(3, 3, 1); return s; };
    for (const k of ['A', 'B']) {
      const col = k === 'A' ? 0xff6b6b : 0x4dabf7; const p = SITES[k];
      const disc = new THREE.Mesh(new THREE.CircleGeometry(3, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35 })); disc.rotation.x = -Math.PI / 2; disc.position.set(p.x, 0.02, p.z); this.scene.add(disc);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 12, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, side: THREE.DoubleSide })); beam.position.set(p.x, 7, p.z); this.scene.add(beam);
      const s = label(k, k === 'A' ? '#ff6b6b' : '#4dabf7'); s.position.set(p.x, 5.2, p.z); this.scene.add(s);
    }
    this.bombMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.35), new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0xff0000, emissiveIntensity: 0.6 })); this.bombMesh.visible = false; this.scene.add(this.bombMesh);
    this.bomb = { planted: false, pos: new THREE.Vector3(), t: 0 };
  }
  buildViewmodel() {
    this.vm = new THREE.Group(); this.camera.add(this.vm); const dark = new THREE.MeshLambertMaterial({ color: 0x2b2b2b }), mid = new THREE.MeshLambertMaterial({ color: 0x55606e });
    const mk = (parts) => { const g = new THREE.Group(); for (const [w, h, d, x, y, z, m] of parts) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); } g.position.set(0.24, -0.24, -0.5); this.vm.add(g); g.visible = false; return g; };
    this.models = [mk([[0.06, 0.09, 0.3, 0, 0, 0, dark], [0.05, 0.12, 0.07, 0, -0.09, 0.08, mid]]), mk([[0.07, 0.1, 0.5, 0, 0, 0, dark], [0.05, 0.16, 0.07, 0, -0.12, 0.05, mid], [0.04, 0.05, 0.2, 0, 0.05, -0.1, mid]]), mk([[0.06, 0.08, 0.95, 0, 0, -0.1, dark], [0.05, 0.05, 0.22, 0, 0.08, -0.1, mid], [0.07, 0.12, 0.2, 0, -0.05, 0.4, mid]])];
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe28a })); this.flash.position.set(0.24, -0.2, -1.0); this.flash.visible = false; this.vm.add(this.flash);
  }
  buildHud() {
    const r = this.root; this.hud = document.createElement('div'); this.hud.className = 'hud'; this.hud.style.display = 'none';
    this.hud.innerHTML = `<div class="dm"></div><div class="sc"></div><div class="xh"></div><div class="hs">HEADSHOT</div><div class="tp"></div><div class="kf"></div><div class="pr" style="display:none"></div><div class="bl"><div class="hp">100</div><div class="hb"><i></i></div></div><div class="br"></div>`;
    r.appendChild(this.hud); this.mm = document.createElement('canvas'); this.mm.className = 'mm'; this.mm.width = 112; this.mm.height = 88; this.mm.style.display = 'none'; r.appendChild(this.mm);
    const $ = (s) => this.hud.querySelector(s); this.e = { dm: $('.dm'), sc: $('.sc'), xh: $('.xh'), hs: $('.hs'), tp: $('.tp'), kf: $('.kf'), pr: $('.pr'), hp: $('.hp'), hb: $('.hb i'), br: $('.br') };
    this.ov = document.createElement('div'); this.ov.className = 'ov'; r.appendChild(this.ov);
  }
  showOverlay(html, btns) {
    this.ov.style.display = 'flex'; this.ov.innerHTML = html; const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center';
    for (const [t, fn, alt] of btns) { const b = document.createElement('button'); b.textContent = t; if (alt) b.className = 'alt'; b.onclick = fn; row.appendChild(b); } this.ov.appendChild(row);
  }
  showMenu() {
    this.state = 'menu'; this.hud.style.display = 'none'; this.mm.style.display = 'none';
    this.showOverlay(`<h2>Sniper Chill</h2><p>Prototipo jugable. Tú contra 5 bots. Planta la bomba en el sitio A o B (mantén E) y aguanta hasta que explote, o elimínalos a todos.</p><p><b>WASD</b> moverte · <b>ratón</b> apuntar · <b>clic</b> disparar · <b>clic derecho</b> mirilla sniper · <b>1 2 3</b> armas · <b>R</b> recargar · <b>E</b> plantar/desactivar · <b>espacio</b> saltar</p><p>Sniper: 1 tiro y muerto. Pistola y ametralladora: barra de vida, pero un tiro a la cabeza mata.</p>`,
      [['Bomba contra bots', () => this.start('bomb')], ['Reto diario (60 s, ranking)', () => this.start('daily'), true]]);
  }
  start(mode) {
    this.mode = mode; for (const b of this.bots) b.remove(); this.bots = []; this.pos.copy(SPAWN); this.yaw = -Math.PI / 2; this.pitch = 0; this.mx = 0; this.my = 0; this.hp = 100; this.alive = true; this.time = 0; this.kills = 0; this.heads = 0; this.score = 0; this.bomb.planted = false; this.bombMesh.visible = false; this.defuser = null; this.defuseT = 0; this.plantT = 0; this.cur = mode === 'daily' ? 2 : 0; this.ammo = WEAPONS.map((w) => w.mag); this.reloading = 0; this.fireCd = 0; this.fov = 75; this.fx.forEach((f) => this.scene.remove(f.o)); this.fx = []; this.kfLog = [];
    if (mode === 'bomb') { this.roundT = 150; BOT_SPOTS.slice(0, 5).forEach(([x, z]) => { let tx = x, tz = z; while (solid(tx, tz)) tx++; this.bots.push(new Bot(this, (tx + 0.5) * T, (tz + 0.5) * T, false)); }); }
    else { this.roundT = 60; this.rng = mulberry(Number(new Date().toISOString().slice(0, 10).replace(/-/g, ''))); this.spawnT = 0.5; this.dailySeedCandidates = []; for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (!solid(x, z) && this.los(new THREE.Vector3(SPAWN.x, EYE, SPAWN.z), new THREE.Vector3((x + 0.5) * T, 1.2, (z + 0.5) * T)) && Math.hypot(x * T - SPAWN.x, z * T - SPAWN.z) > 8) this.dailySeedCandidates.push([x, z]); }
    this.fPlayer = flow(Math.floor(this.pos.x / T), Math.floor(this.pos.z / T)); this.flowT = 0;
    this.ov.style.display = 'none'; this.hud.style.display = 'block'; this.mm.style.display = 'block'; this.state = 'play'; this.setWeapon(this.cur); this.requestLock(); this.audio();
  }
  audio() { try { this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)(); this.ac.resume && this.ac.resume(); } catch (e) {} }
  sound(kind) {
    const ac = this.ac; if (!ac) return; const t = ac.currentTime;
    if (kind === 'beep') { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.09); return; }
    const len = kind === 'boom' ? 1.2 : kind === 'sniper' ? 0.35 : 0.12; const buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = ac.createBufferSource(); s.buffer = buf; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'boom' ? 300 : kind === 'bot' ? 900 : 2200; const g = ac.createGain(); g.gain.value = kind === 'boom' ? 0.9 : kind === 'bot' ? 0.12 : 0.3; s.connect(f).connect(g).connect(ac.destination); s.start(t);
  }
  requestLock() { try { const p = this.canvas.requestPointerLock && this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { this.lock = 'none'; }); } catch (e) { this.lock = 'none'; } }
  bindEvents() {
    const d = document;
    d.addEventListener('pointerlockchange', () => { const on = d.pointerLockElement === this.canvas; if (on) this.lock = 'on'; else if (this.lock === 'on') { this.lock = 'none'; if (this.state === 'play') this.pause(); } });
    d.addEventListener('pointerlockerror', () => { this.lock = 'none'; });
    d.addEventListener('mousemove', (e) => { if (this.state !== 'play') return; if (this.lock === 'on') { const k = this.fov / 75 * 0.0022; this.yaw -= e.movementX * k; this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - e.movementY * k)); } });
    this.canvas.addEventListener('mousemove', (e) => { const r = this.canvas.getBoundingClientRect(); this.mx = ((e.clientX - r.left) / r.width - 0.5) * 2; this.my = ((e.clientY - r.top) / r.height - 0.5) * 2; });
    this.canvas.addEventListener('mouseleave', () => { this.mx = 0; this.my = 0; });
    this.canvas.addEventListener('mousedown', (e) => { if (this.state === 'pause') return; if (this.state !== 'play') return; if (this.lock !== 'on') this.requestLock(); this.audio(); if (e.button === 0) this.mouseDown = true; if (e.button === 2) this.rmb = true; e.preventDefault(); });
    d.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; if (e.button === 2) this.rmb = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    d.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.state === 'play') { this.pause(); return; } if (this.state !== 'play' && this.state !== 'pause') return; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); this.keys[e.code] = true; if (this.state !== 'play') return; if (e.code === 'Digit1' && this.mode === 'bomb') this.setWeapon(0); if (e.code === 'Digit2') this.setWeapon(1); if (e.code === 'Digit3') this.setWeapon(2); if (e.code === 'Digit1' && this.mode === 'daily') this.setWeapon(0); if (e.code === 'KeyR') this.reload(); if (e.code === 'Space' && this.py === 0) this.vy = 5.5; });
    d.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.root);
    this.py = 0; this.vy = 0;
  }
  pause() { this.state = 'pause'; this.mouseDown = false; this.rmb = false; this.showOverlay('<h2>Pausa</h2><p>Haz clic para seguir jugando.</p>', [['Continuar', () => { this.ov.style.display = 'none'; this.state = 'play'; this.requestLock(); this.audio(); }], ['Salir al menú', () => this.showMenu(), true]]); }
  resize() { const w = this.root.clientWidth || 640, h = this.root.clientHeight || 360; this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setWeapon(i) { this.cur = i; this.models.forEach((m, k) => { m.visible = k === i; }); this.rmb = false; }
  reload() { const w = WEAPONS[this.cur]; if (this.reloading > 0 || this.ammo[this.cur] === w.mag) return; this.reloading = w.reload; }
  eyeY() { return EYE + this.py; }
  los(a, b) { const dir = b.clone().sub(a); const dist = dir.length(); dir.normalize(); this.raycaster.set(a, dir); this.raycaster.far = dist; const h = this.raycaster.intersectObjects(this.solids, false); return h.length === 0 || h[0].distance > dist - 0.25; }
  pushFx(o, life) { this.scene.add(o); this.fx.push({ o, t: life }); }
  tracer(a, b, color) { const g = new THREE.BufferGeometry().setFromPoints([a, b]); this.pushFx(new THREE.Line(g, new THREE.LineBasicMaterial({ color })), 0.07); }
  log(msg) { this.kfLog.push([msg, this.time + 4]); }
  botShoot(bot, dist) {
    const g = this; const e = bot.eye(); const tgt = new THREE.Vector3(this.pos.x, this.eyeY() - 0.3, this.pos.z); this.sound('bot');
    let p = Math.max(0.08, 0.38 - dist * 0.011); if (this.keys.KeyW || this.keys.KeyA || this.keys.KeyS || this.keys.KeyD) p *= 0.65;
    const hit = Math.random() < p; if (hit) { this.hp -= 6 + Math.floor(Math.random() * 6); this.e.dm.style.opacity = 1; if (this.hp <= 0) { this.hp = 0; this.die(); } }
    const miss = hit ? 0 : 0.9; this.tracer(e, tgt.clone().add(new THREE.Vector3((Math.random() - 0.5) * miss * 2, (Math.random() - 0.5) * miss, (Math.random() - 0.5) * miss * 2)), 0xff7a7a);
  }
  die() { if (!this.alive) return; this.alive = false; this.end(false, 'Te han eliminado.'); }
  onKill(bot, head) {
    if (bot.dummy) { this.kills++; this.score += 100 + (head ? 50 : 0); } else { this.kills++; this.log(head ? 'Headshot a un bot' : 'Bot eliminado'); }
    if (head) { this.heads++; this.e.hs.style.opacity = 1; } this.e.xh.classList.add('hit'); setTimeout(() => this.e.xh.classList.remove('hit'), 120); if (!bot.dummy) this.sound('beep');
    if (!bot.dummy && this.bots.every((b) => b.dead)) this.end(true, 'Has eliminado a todos los bots.');
  }
  fire() {
    const w = WEAPONS[this.cur]; if (this.reloading > 0 || this.fireCd > 0) return; if (this.ammo[this.cur] <= 0) { this.reload(); return; }
    this.ammo[this.cur]--; this.fireCd = w.rate; const scoped = w.scope && this.rmb; const moving = this.keys.KeyW || this.keys.KeyA || this.keys.KeyS || this.keys.KeyD;
    let sp = scoped ? 0.002 : w.spread + (moving ? 0.015 : 0) + (this.py > 0 ? 0.03 : 0); if (this.cur === 1) sp += Math.min(0.03, (this.burst || 0) * 0.004); this.burst = (this.burst || 0) + 1;
    const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir); const right = new THREE.Vector3().crossVectors(dir, this.camera.up).normalize(), up = new THREE.Vector3().crossVectors(right, dir).normalize();
    dir.addScaledVector(right, (Math.random() - 0.5) * 2 * sp).addScaledVector(up, (Math.random() - 0.5) * 2 * sp).normalize();
    const origin = new THREE.Vector3(this.pos.x, this.eyeY(), this.pos.z); this.raycaster.set(origin, dir); this.raycaster.far = 80;
    const targets = [...this.solids]; for (const b of this.bots) if (!b.dead) targets.push(...b.parts);
    const h = this.raycaster.intersectObjects(targets, false)[0]; const end = h ? h.point : origin.clone().addScaledVector(dir, 60);
    const mz = origin.clone().addScaledVector(dir, 0.6); mz.y -= 0.15; mz.addScaledVector(right, 0.2); this.tracer(mz, end, 0xfff3a0); this.sound(this.cur === 2 ? 'sniper' : 'shot');
    if (h && h.object.userData.bot) { const ud = h.object.userData; const head = ud.part === 'head'; ud.bot.damage(w.dmg, head); this.e.xh.classList.add('hit'); setTimeout(() => this.e.xh.classList.remove('hit'), 90); }
    if (!scoped || !w.scope) { this.vmKick = 0.06; } else this.vmKick = 0;
    this.pitch = Math.min(1.45, this.pitch + w.kick * (scoped ? 0.4 : 1)); this.flash.visible = !scoped; this.flashT = 0.04;
    for (const b of this.bots) if (!b.dead && !b.dummy && Math.hypot(b.pos.x - this.pos.x, b.pos.z - this.pos.z) < (this.cur === 2 ? 50 : 26)) b.alert = true;
    if (this.ammo[this.cur] === 0) this.reload();
  }
  end(win, msg) {
    if (this.state !== 'play') return; this.state = 'over'; this.mouseDown = false; this.rmb = false; try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {} this.lock = 'none';
    let extra = ''; if (this.mode === 'daily') { extra = this.saveScore(); }
    this.showOverlay(`<h2>${win ? 'Victoria' : 'Derrota'}</h2><p>${msg}</p><p>Bajas: ${this.kills} · Headshots: ${this.heads}${this.mode === 'daily' ? ' · Puntos: ' + this.score : ''}</p>${extra}`, [['Jugar otra vez', () => this.start(this.mode)], ['Menú', () => this.showMenu(), true]]);
  }
  saveScore() {
    const key = 'sniperchill_' + new Date().toISOString().slice(0, 10); let list = []; try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
    list.push(this.score); list.sort((a, b) => b - a); list = list.slice(0, 5); try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
    return `<p><b>Ranking de hoy (solo este dispositivo)</b><br>${list.map((s, i) => `${i + 1}. ${s}`).join(' · ')}</p><p style="opacity:.7">Ranking global entre jugadores: siguiente paso, necesita servidor.</p>`;
  }
  loop(now) {
    if (!this.running) return; requestAnimationFrame(this.loop); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (this.state === 'play') this.update(dt); else if (this.state === 'over') { for (const b of this.bots) b.update(dt); }
    this.render();
  }
  update(dt) {
    this.time += dt; const k = this.keys;
    if (k.ArrowLeft) this.yaw += 2 * dt; if (k.ArrowRight) this.yaw -= 2 * dt; if (k.ArrowUp) this.pitch = Math.min(1.45, this.pitch + 1.5 * dt); if (k.ArrowDown) this.pitch = Math.max(-1.45, this.pitch - 1.5 * dt);
    if (this.lock !== 'on') { const dead = 0.1, f = (v) => { const a = Math.abs(v); return a < dead ? 0 : Math.sign(v) * Math.pow((a - dead) / (1 - dead), 1.4); }; const z = this.fov / 75; this.yaw -= f(this.mx) * 2.8 * dt * z; this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - f(this.my) * 1.8 * dt * z)); }
    let fx = 0, fz = 0; if (k.KeyW) fz += 1; if (k.KeyS) fz -= 1; if (k.KeyD) fx += 1; if (k.KeyA) fx -= 1;
    const len = Math.hypot(fx, fz) || 1; const sp = (this.rmb && this.cur === 2 ? 2.2 : 5) ; const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const mx = (-sy * fz + cy * fx) / len * sp * dt, mz = (-cy * fz - sy * fx) / len * sp * dt; if (!blocked(this.pos.x + mx, this.pos.z, 0.35)) this.pos.x += mx; if (!blocked(this.pos.x, this.pos.z + mz, 0.35)) this.pos.z += mz;
    if (this.py > 0 || this.vy > 0) { this.vy -= 16 * dt; this.py += this.vy * dt; if (this.py <= 0) { this.py = 0; this.vy = 0; } }
    this.fireCd -= dt; if (this.reloading > 0) { this.reloading -= dt; if (this.reloading <= 0) { this.ammo[this.cur] = WEAPONS[this.cur].mag; } }
    const w = WEAPONS[this.cur]; if (this.mouseDown && (w.auto || !this.wasDown) && this.fireCd <= 0) this.fire(); if (!this.mouseDown) this.burst = 0; this.wasDown = this.mouseDown;
    const wantFov = w.scope && this.rmb ? 18 : 75; this.fov += (wantFov - this.fov) * Math.min(1, dt * 14); this.camera.fov = this.fov; this.camera.updateProjectionMatrix();
    this.flowT -= dt; if (this.flowT <= 0) { this.flowT = 0.4; this.fPlayer = flow(Math.floor(this.pos.x / T), Math.floor(this.pos.z / T)); }
    for (const b of this.bots) b.update(dt); this.bots = this.bots.filter((b) => !b.gone);
    if (this.mode === 'bomb') this.updateBomb(dt); else this.updateDaily(dt);
    this.updateHud(dt);
  }
  updateBomb(dt) {
    this.roundT -= dt; const near = ['A', 'B'].find((s) => Math.hypot(SITES[s].x - this.pos.x, SITES[s].z - this.pos.z) < 3.2);
    const pr = this.e.pr; pr.style.display = 'none';
    if (!this.bomb.planted) {
      if (near) { pr.style.display = 'block'; pr.innerHTML = `Mantén <b>E</b> para plantar en ${near}<div class="pb"><i style="width:${this.plantT / 3 * 100}%"></i></div>`; }
      if (near && this.keys.KeyE) { this.plantT += dt; if (this.plantT >= 3) { this.bomb.planted = true; this.bomb.pos.copy(this.pos); this.bomb.pos.y = 0.12; this.bomb.t = 40; this.bombMesh.position.copy(this.bomb.pos); this.bombMesh.visible = true; this.fBomb = flow(Math.floor(this.pos.x / T), Math.floor(this.pos.z / T)); this.defuseT = 0; this.log('Bomba plantada en ' + near); this.sound('beep'); this.nextBeep = 0; } } else this.plantT = 0;
      if (this.roundT <= 0) this.end(false, 'Se acabó el tiempo sin plantar la bomba.');
    } else {
      this.bomb.t -= dt; this.nextBeep -= dt; if (this.nextBeep <= 0) { this.sound('beep'); this.nextBeep = Math.max(0.15, this.bomb.t / 40); this.bombMesh.material.emissiveIntensity = 1.5; } else this.bombMesh.material.emissiveIntensity = 0.4;
      const alive = this.bots.filter((b) => !b.dead); if (!this.defuser || this.defuser.dead) { this.defuser = alive.sort((a, b) => Math.hypot(a.pos.x - this.bomb.pos.x, a.pos.z - this.bomb.pos.z) - Math.hypot(b.pos.x - this.bomb.pos.x, b.pos.z - this.bomb.pos.z))[0] || null; this.defuseT = 0; }
      if (this.defuser && this.defuseT > 0) { pr.style.display = 'block'; pr.innerHTML = `¡Un bot está desactivando la bomba!<div class="pb"><i style="width:${this.defuseT / 5 * 100}%;background:#ff5a5a"></i></div>`; }
      if (this.defuseT >= 5) this.end(false, 'Los bots han desactivado la bomba.');
      if (this.bomb.t <= 0) { this.sound('boom'); this.e.dm.style.background = '#fff'; this.e.dm.style.opacity = 1; this.end(true, 'La bomba ha explotado. ¡Ronda tuya!'); }
    }
  }
  updateDaily(dt) {
    this.roundT -= dt; this.spawnT -= dt; this.bots.forEach((b) => { if (!b.dead && b.life > 5) { b.remove(); b.gone = true; } });
    const active = this.bots.filter((b) => !b.dead && !b.gone).length;
    if (this.spawnT <= 0 && active < 3 && this.dailySeedCandidates.length) { this.spawnT = 1.1; const c = this.dailySeedCandidates[Math.floor(this.rng() * this.dailySeedCandidates.length)]; this.bots.push(new Bot(this, (c[0] + 0.5) * T, (c[1] + 0.5) * T, true)); }
    if (this.roundT <= 0) this.end(true, 'Tiempo. Reto del día completado.');
  }
  updateHud(dt) {
    const e = this.e; e.hp.textContent = 'Vida ' + Math.ceil(this.hp); e.hb.style.width = Math.max(0, this.hp) + '%';
    e.dm.style.opacity = Math.max(0, (parseFloat(e.dm.style.opacity) || 0) - dt * 2); if (!e.dm.style.opacity) e.dm.style.opacity = 0;
    e.hs.style.opacity = Math.max(0, (parseFloat(e.hs.style.opacity) || 0) - dt * 1.5);
    const w = WEAPONS[this.cur]; e.br.innerHTML = `${w.name}<br>${this.reloading > 0 ? 'Recargando...' : this.ammo[this.cur] + ' / ' + w.mag}<br><span style="font-size:.7em;opacity:.8">1 Pistola · 2 Ametr. · 3 Sniper</span>`;
    const m = Math.floor(this.roundT / 60), s = String(Math.max(0, Math.floor(this.roundT % 60))).padStart(2, '0');
    e.tp.innerHTML = this.mode === 'bomb' ? (this.bomb.planted ? `BOMBA ${Math.max(0, Math.ceil(this.bomb.t))}s · Bots ${this.bots.filter((b) => !b.dead).length}` : `Planta en A o B · ${m}:${s} · Bots ${this.bots.filter((b) => !b.dead).length}`) : `Reto diario · ${m}:${s} · Puntos ${this.score}`;
    e.sc.style.display = this.rmb && w.scope ? 'block' : 'none'; e.xh.style.display = this.rmb && w.scope ? 'none' : 'block';
    this.kfLog = this.kfLog.filter((l) => l[1] > this.time); e.kf.innerHTML = this.kfLog.map((l) => l[0]).join('<br>');
    if (this.lock !== 'on' && this.time < 25) e.kf.innerHTML += '<br><span style="opacity:.9">Gira moviendo el cursor hacia los lados (más lejos = más rápido) o con las flechas</span>';
    this.drawMap();
  }
  drawMap() {
    const c = this.mm.getContext('2d'), s = 3.2; c.clearRect(0, 0, 112, 88); c.save(); c.translate(2, 2);
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) { const ch = MAP[z][x]; if (ch === '#') { c.fillStyle = '#8aa1b8'; c.fillRect(x * s, z * s, s, s); } else if (ch === 'c') { c.fillStyle = '#c98b4a'; c.fillRect(x * s, z * s, s, s); } }
    if (this.mode === 'bomb') for (const k of ['A', 'B']) { c.fillStyle = k === 'A' ? '#ff6b6b' : '#4dabf7'; c.fillRect(SITES[k].x / T * s - 3, SITES[k].z / T * s - 3, 6, 6); }
    if (this.bomb.planted) { c.fillStyle = '#ff0'; c.fillRect(this.bomb.pos.x / T * s - 2, this.bomb.pos.z / T * s - 2, 4, 4); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(this.pos.x / T * s, this.pos.z / T * s, 2.5, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(this.pos.x / T * s, this.pos.z / T * s); c.lineTo(this.pos.x / T * s - Math.sin(this.yaw) * 7, this.pos.z / T * s - Math.cos(this.yaw) * 7); c.stroke(); c.restore();
  }
  render() {
    this.camera.position.set(this.pos.x, this.eyeY(), this.pos.z); this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.vmKick = Math.max(0, (this.vmKick || 0) - 0.5 * 0.016); this.vm.position.z = this.vmKick; this.vm.visible = !(this.rmb && WEAPONS[this.cur].scope && this.state === 'play');
    if (this.flashT > 0) { this.flashT -= 0.016; if (this.flashT <= 0) this.flash.visible = false; }
    for (let i = this.fx.length - 1; i >= 0; i--) { this.fx[i].t -= 0.016; if (this.fx[i].t <= 0) { this.scene.remove(this.fx[i].o); this.fx[i].o.geometry.dispose(); this.fx.splice(i, 1); } }
    if (this.state !== 'play') this.vm.visible = false;
    this.renderer.render(this.scene, this.camera);
  }
  destroy() { this.running = false; this.ro && this.ro.disconnect(); try { document.exitPointerLock(); } catch (e) {} this.renderer.dispose(); }
}
