/* killcam.js - Sniper Chill: visible bullets, slow-motion kill cam, ragdoll death, shareable replay.
 * Dependency-free ES module (needs only the THREE namespace you already load). Stylized, no gore.
 *
 * ---------------------------------------------------------------------------------------------
 * API
 *   import { createKillCam } from './killcam.js';
 *   const kc = createKillCam(THREE, { scene, camera, renderer, root, raycast, colliders, getGround, config, ...hooks });
 *
 *   opts.scene/camera/renderer   required (camera must already be in the scene tree).
 *   opts.root                    DOM element for the overlay UI (default renderer.domElement.parentElement).
 *   opts.raycast / opts.colliders  OPTIONAL hitscan.js raycast + game.world; keep the replay camera out of walls.
 *   opts.getGround(x,z)          OPTIONAL floor height (map.getHeight); -Infinity/NaN treated as 0.
 *   opts.hideHud(bool)           OPTIONAL called true at kill-cam start, false at end (hide your HUD).
 *   opts.onStart(info) opts.onImpact(info) opts.onEnd(info) opts.onReplay(replay) opts.onSound(name)
 *   opts.onFrame(recCanvas,{t,phase})  called for each recorded frame (debug / custom capture).
 *   opts.config                  overrides, see DEFAULTS below.
 *
 *   kc.shoot({ muzzle, end, weapon, hit })      call once per bullet instead of game.tracer().
 *        muzzle/end  {x,y,z}|Vector3 (end = hit point or max-range point). weapon 'sniper'|'rifle'|...
 *        hit = null | { kind:'world', normal? }
 *            | { kind:'target', bot, zone:'head'|'body'|'limb', headshot:bool, killed:bool }
 *        Gameplay stays hitscan: apply damage immediately as today; the visible bullet only dresses it.
 *        On kill the bot's own mesh is swapped for a stand-in that is frozen until the bullet arrives,
 *        then turns into a ragdoll. Do NOT reuse bot.group after a kill (it is hidden).
 *   kc.update(realDt) -> timeScale   call once per frame with UNSCALED dt. Multiply game dt by the result.
 *   kc.applyCamera()                 call after your camera update (ctrl.applyToCamera / fov), before render.
 *   kc.afterRender()                 call right after renderer.render(); feeds the replay recorder.
 *   kc.active / kc.timeScale / kc.phase('flight'|'impact'|'outro'|null) / kc.lastReplay
 *   kc.skip()  kc.clear() (call on round restart)  kc.share()  kc.download()  kc.dispose()
 *   kc.lastReplay = { blob, url, mime, duration, poster:Blob|null, filename }  (webm/mp4 3-5 s, watermarked)
 *   kc.config is live: kc.config.bodyKills = 'always' | 'far' | 'never', kc.config.enabled = false, ...
 * ---------------------------------------------------------------------------------------------
 */
const DEFAULTS = {
  enabled: true, lang: 'es',
  bodyKills: 'far',          // 'always' | 'far' (>= minDistance) | 'never'  (headshot kills always get a cam)
  headshotAlways: true, minDistance: 16, cooldown: 6,
  bulletSpeed: 160, sniperSpeed: 220, trailLength: 4.5,
  flightSpeed: 42,           // apparent m/s of the bullet in the kill cam (flight time = dist/this, clamped)
  minFlight: 1.0, maxFlight: 2.2, impactTime: 1.5, outroTime: 0.9,
  slowScale: 0.06, impactScale: 0.2, outroScale: 0.5,
  ragdollLife: 4.5, gravity: 15,
  record: true, recordWidth: 960, fps: 30, bitrate: 3500000, watermark: 'SNIPER CHILL',
  sound: true, toast: true, toastSeconds: 7,
  colors: { bullet: 0xffd479, trail: 0xff7ac8, ring: 0x7ae7ff, head: 0xffd479, body: 0x7ae7ff },
};
const T = {
  es: { head: 'HEADSHOT', body: 'BAJA', share: 'Compartir clip', save: 'Guardar', ready: 'Replay listo', shareText: 'Mi killcam en Sniper Chill' },
  en: { head: 'HEADSHOT', body: 'ELIMINATED', share: 'Share clip', save: 'Save', ready: 'Replay ready', shareText: 'My Sniper Chill killcam' },
};
const CSS = `
.kc-ui{position:absolute;inset:0;pointer-events:none;z-index:40;overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.kc-ui .bar{position:absolute;left:0;right:0;height:11%;background:#000;transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.kc-ui .top{top:0;transform:translateY(-101%)}.kc-ui .bot{bottom:0;transform:translateY(101%)}
.kc-ui.on .bar{transform:none}
.kc-ui .vig{position:absolute;inset:0;opacity:0;transition:opacity .4s;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(40,10,60,.55) 100%)}
.kc-ui.on .vig{opacity:1}
.kc-ui .flash{position:absolute;inset:0;background:#fff;opacity:0}
.kc-ui .flash.go{animation:kcf .35s ease-out}
@keyframes kcf{0%{opacity:.85}100%{opacity:0}}
.kc-ui .cap{position:absolute;left:0;right:0;bottom:15%;text-align:center;color:#fff;opacity:0;transform:translateY(12px) scale(.94);transition:all .35s cubic-bezier(.2,.9,.2,1);text-shadow:0 3px 0 #ff4fa8,0 0 24px rgba(255,122,200,.8)}
.kc-ui .cap.show{opacity:1;transform:none}
.kc-ui .cap b{display:block;font-size:clamp(28px,6vw,64px);letter-spacing:.12em;font-weight:900;font-style:italic}
.kc-ui .cap i{display:block;font-style:normal;font-size:clamp(14px,2.2vw,24px);font-weight:700;letter-spacing:.2em;opacity:.95}
.kc-ui .toast{position:absolute;right:14px;bottom:70px;display:none;gap:8px;align-items:center;pointer-events:auto;background:rgba(20,16,40,.86);color:#fff;border:2px solid #ffd479;border-radius:14px;padding:8px 10px;font-weight:700;font-size:14px;box-shadow:0 6px 24px rgba(0,0,0,.4)}
.kc-ui .toast.show{display:flex;animation:kct .4s cubic-bezier(.2,1.4,.4,1)}
@keyframes kct{0%{transform:translateY(30px) scale(.8);opacity:0}100%{transform:none;opacity:1}}
.kc-ui .toast button{font:inherit;border:0;border-radius:9px;padding:7px 11px;background:#ffd479;color:#222;cursor:pointer}
.kc-ui .toast button.x{background:transparent;color:#fff;padding:7px 6px}
.kc-ui .toast video{height:44px;border-radius:7px;display:block}
`;

export function createKillCam(THREE, opts) {
  const { scene, camera, renderer } = opts;
  const cfg = Object.assign({}, DEFAULTS, opts.config || {});
  cfg.colors = Object.assign({}, DEFAULTS.colors, (opts.config && opts.config.colors) || {});
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const toV = (p) => (p && p.isVector3 ? p.clone() : V(p.x, p.y, p.z));
  const UP = V(0, 1, 0), clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t, sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const str = () => T[cfg.lang] || T.es;
  const root = opts.root || renderer.domElement.parentElement || document.body;
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';

  // ---------- DOM ----------
  if (!document.getElementById('kc-css')) { const s = document.createElement('style'); s.id = 'kc-css'; s.textContent = CSS; document.head.appendChild(s); }
  const ui = document.createElement('div'); ui.className = 'kc-ui';
  ui.innerHTML = '<div class="vig"></div><div class="bar top"></div><div class="bar bot"></div><div class="flash"></div><div class="cap"><b></b><i></i></div><div class="toast"></div>';
  root.appendChild(ui);
  const $ = (s) => ui.querySelector(s), elFlash = $('.flash'), elCap = $('.cap'), elToast = $('.toast');
  const flash = () => { elFlash.classList.remove('go'); void elFlash.offsetWidth; elFlash.classList.add('go'); };

  // ---------- shared assets ----------
  const geoBox = new THREE.BoxGeometry(1, 1, 1);
  const geoCyl = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5); // unit, base at 0, +z
  const geoCore = new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8).rotateX(Math.PI / 2);
  const geoRing = new THREE.RingGeometry(0.85, 1, 40);
  const geoSph = new THREE.SphereGeometry(1, 8, 6);
  const mkTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); return t; };
  const texGlow = mkTex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  const texStar = mkTex(128, 128, (g, w) => { g.translate(w / 2, w / 2); g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? w * 0.2 : w * 0.48; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); });
  const confettiCols = [0xff7ac8, 0x7ae7ff, 0xffd479, 0xffffff, 0xa78bff, 0x8dffb0].map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
  const dustMat = new THREE.MeshBasicMaterial({ color: 0xe9dcc8, transparent: true, opacity: 0.55, depthWrite: false });
  const addMat = (color, op = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const sprMat = (tex, color, op = 1) => new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false });

  // ---------- state ----------
  let clock = 0, lastCineEnd = -99, cine = null, timeScale = 1, disposed = false;
  const bullets = [], parts = [], rings = [], sprites = [], ragdolls = [], decals = [];
  let lastReplay = null;
  const hiddenKids = [];
  const live = { pos: V(), quat: new THREE.Quaternion(), fov: 75 };

  // ---------- sound (tiny synth, optional) ----------
  let actx = null;
  function ac() { if (!cfg.sound) return null; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; } return actx; }
  function noise(a, dur) { const n = a.sampleRate * dur, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const s = a.createBufferSource(); s.buffer = b; return s; }
  function sfx(name, p = {}) {
    if (opts.onSound) opts.onSound(name, p); const a = ac(); if (!a) return; const t0 = a.currentTime;
    const g = a.createGain(); g.connect(a.destination);
    if (name === 'whoosh') { const s = noise(a, p.dur || 1.5), f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(200, t0); f.frequency.exponentialRampToValueAtTime(1800, t0 + (p.dur || 1.5)); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.28, t0 + 0.2); g.gain.linearRampToValueAtTime(0.0001, t0 + (p.dur || 1.5)); s.connect(f); f.connect(g); s.start(t0); }
    else if (name === 'thud') { const o = a.createOscillator(); o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(34, t0 + 0.5); g.gain.setValueAtTime(0.6, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6); o.connect(g); o.start(t0); o.stop(t0 + 0.65); }
    else if (name === 'ping') { [880, 1320, 1760].forEach((fr, i) => { const o = a.createOscillator(), gg = a.createGain(); o.type = 'sine'; o.frequency.value = fr; gg.gain.setValueAtTime(0.0001, t0 + i * 0.07); gg.gain.linearRampToValueAtTime(0.14, t0 + i * 0.07 + 0.02); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.07 + 0.7); o.connect(gg); gg.connect(a.destination); o.start(t0 + i * 0.07); o.stop(t0 + i * 0.07 + 0.8); }); }
  }

  // ---------- effects ----------
  function addSprite(tex, color, pos, size, life, o = {}) {
    const s = new THREE.Sprite(sprMat(tex, color, o.op ?? 1)); s.position.copy(pos); s.scale.set(size, size, 1); s.renderOrder = 20; scene.add(s);
    sprites.push({ s, life, max: life, size, grow: o.grow ?? 1.6, vy: o.vy || 0, op: o.op ?? 1 }); return s;
  }
  function textSprite(text, color, pos, life) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
    g.font = '900 italic 110px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 22; g.strokeStyle = '#3a1450'; g.strokeText(text, 256, 84); g.fillStyle = color; g.fillText(text, 256, 84);
    const tex = new THREE.CanvasTexture(c); const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false });
    const s = new THREE.Sprite(m); s.position.copy(pos); s.scale.set(1.5, 0.47, 1); s.renderOrder = 30; scene.add(s);
    sprites.push({ s, life, max: life, size: 1.5, grow: 0.25, vy: 0.9, op: 1, text: true, tex });
  }
  function ring(pos, dir, size, color, life, grow = 1) {
    const m = new THREE.Mesh(geoRing, addMat(color, 0.9)); m.position.copy(pos); m.quaternion.setFromUnitVectors(V(0, 0, 1), dir); m.scale.setScalar(size * 0.15); scene.add(m);
    rings.push({ m, life, max: life, size, grow });
  }
  function confetti(pos, dir, n, spread, speed, cols) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geoBox, cols ? cols[i % cols.length] : confettiCols[i % confettiCols.length]); const sz = 0.05 + Math.random() * 0.07;
      m.scale.set(sz, sz, sz * 0.3); m.position.copy(pos); scene.add(m);
      const v = V((Math.random() - .5) * spread, (Math.random() - .3) * spread, (Math.random() - .5) * spread).addScaledVector(dir, speed * (0.4 + Math.random()));
      parts.push({ m, v, g: 9, life: 1.1 + Math.random() * 0.9, max: 2, spin: V(Math.random() * 9, Math.random() * 9, Math.random() * 9), shrink: true });
    }
  }
  function puff(pos, nrm, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geoSph, dustMat.clone()); m.scale.setScalar(0.08 + Math.random() * 0.08); m.position.copy(pos); scene.add(m);
      const v = V((Math.random() - .5) * 1.4, Math.random() * 1.2, (Math.random() - .5) * 1.4).addScaledVector(nrm, 1.8 * Math.random());
      parts.push({ m, v, g: -0.5, life: 0.7 + Math.random() * 0.5, max: 1.2, spin: V(), grow: 3.2, fade: true });
    }
  }
  function decal(pos, nrm) {
    const m = new THREE.Mesh(geoRing, new THREE.MeshBasicMaterial({ color: 0x2a2140, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.scale.setScalar(0.12); m.position.copy(pos).addScaledVector(nrm, 0.02); m.quaternion.setFromUnitVectors(V(0, 0, 1), nrm); scene.add(m); decals.push({ m, life: 7, max: 7 });
    if (decals.length > 24) { const d = decals.shift(); scene.remove(d.m); d.m.material.dispose(); }
  }

  function impactFx(sh) {
    const h = sh.hit, p = sh.end, d = sh.dir;
    if (!h || h.kind === 'world') {
      if (h) { const n = h.normal ? toV(h.normal) : d.clone().negate(); puff(p, n, 7); confetti(p, n, 8, 2.2, 2.2, [confettiCols[2], confettiCols[3]]); ring(p, n, 0.5, cfg.colors.ring, 0.35); decal(p, n); }
      return;
    }
    const head = !!h.headshot, col = head ? cfg.colors.head : cfg.colors.body, nrm = d.clone().negate();
    addSprite(texStar, col, p, head ? 0.8 : 0.5, 0.28, { grow: 1.2 });
    addSprite(texGlow, 0xffffff, p, head ? 1.2 : 0.8, 0.2, { grow: 0.8 });
    ring(p, d, head ? 2.2 : 1.4, col, head ? 0.7 : 0.45);
    ring(p, d, head ? 3.4 : 2.0, 0xffffff, head ? 0.45 : 0.3);
    confetti(p, nrm.clone().multiplyScalar(0.6).add(V(0, 0.5, 0)), head ? 46 : 22, 4, 3.4);
    if (h.killed) {
      textSprite(head ? ['BONK!', 'POW!', 'CHILL.', 'ZZZAP!'][(Math.random() * 4) | 0] : ['POP!', 'NICE.', 'CHILL.'][(Math.random() * 3) | 0], head ? '#ffd479' : '#7ae7ff', p.clone().add(V(0, 0.9, 0)), 1.1);
      if (head) for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; addSprite(texStar, 0xffd479, p.clone().add(V(Math.cos(a) * 0.5, 0.45 + Math.random() * 0.3, Math.sin(a) * 0.5)), 0.28, 0.9, { grow: 0.4, vy: 0.5 }); }
    }
  }

  // ---------- bullets ----------
  function bulletVisual(color, big) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(geoCore, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })); g.add(core);
    const glow = new THREE.Sprite(sprMat(texGlow, color, 0.95)); glow.scale.setScalar(big ? 0.9 : 0.5); glow.renderOrder = 15; g.add(glow);
    const trail = new THREE.Mesh(geoCyl, addMat(cfg.colors.trail, 0.8)); trail.frustumCulled = false; scene.add(trail); scene.add(g);
    return { g, core, glow, trail };
  }
  function spawnBullet(sh) {
    const big = !!sh.cine, v = bulletVisual(cfg.colors.bullet, big);
    const b = Object.assign({ sh, s: 0, dist: sh.dist, speed: (sh.weapon === 'sniper' ? cfg.sniperSpeed : cfg.bulletSpeed), driven: big, done: false, fade: 0, ringAt: 0, sparkAt: 0 }, v);
    b.g.position.copy(sh.muzzle); b.g.quaternion.setFromUnitVectors(V(0, 0, 1), sh.dir); b.trail.quaternion.copy(b.g.quaternion);
    b.rad = big ? 0.05 : 0.018; b.tlen = big ? cfg.trailLength * 0.6 : cfg.trailLength; bullets.push(b); return b;
  }
  function placeBullet(b) {
    const sh = b.sh, p = sh.muzzle.clone().addScaledVector(sh.dir, b.s);
    b.g.position.copy(p);
    const tail = Math.max(0, b.s - b.tlen); const len = b.s - tail;
    b.trail.position.copy(sh.muzzle).addScaledVector(sh.dir, tail); b.trail.scale.set(b.rad, b.rad, Math.max(0.001, len));
  }
  function arrive(b) {
    b.done = true; b.g.visible = false; const sh = b.sh;
    sh.arrived = true; impactFx(sh);
    const h = sh.hit;
    if (h && h.kind === 'target' && h.killed && sh.rag) { releaseRag(sh.rag, sh.dir, !!h.headshot, sh.end); sfx('thud'); if (h.headshot) sfx('ping'); }
    if (sh.cine && cine && cine.sh === sh) enterImpact();
  }
  function stepBullets(dt, worldDt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.done) {
        b.fade += dt; const k = 1 - b.fade / 0.22; b.trail.material.opacity = Math.max(0, 0.8 * k);
        b.s = Math.min(b.dist, b.s); const tail = Math.max(0, Math.max(b.s - b.tlen, 0)); b.trail.scale.z = Math.max(0.001, (b.dist - tail) * Math.max(0, k));
        if (k <= 0) { scene.remove(b.g, b.trail); b.trail.material.dispose(); b.glow.material.dispose(); b.core.material.dispose(); bullets.splice(i, 1); }
        continue;
      }
      if (b.driven) { /* cine drives s */ } else { b.s += b.speed * worldDt; }
      if (b.s >= b.dist) { b.s = b.dist; placeBullet(b); arrive(b); continue; }
      placeBullet(b);
      if (b.driven) { // wake rings + sparkles for the cinematic flight
        while (b.s > b.ringAt) { const p = b.sh.muzzle.clone().addScaledVector(b.sh.dir, b.ringAt); ring(p, b.sh.dir, 0.9, cfg.colors.ring, 0.9, 1); b.ringAt += 1.6; }
        if (b.s > b.sparkAt) { b.sparkAt = b.s + 0.35; addSprite(texGlow, 0xff9bd9, b.g.position.clone().add(V((Math.random() - .5) * .2, (Math.random() - .5) * .2, (Math.random() - .5) * .2)), 0.25, 0.6, { grow: 0.3 }); }
      }
    }
  }

  // ---------- stand-in + ragdoll ----------
  function makeStandIn(bot) {
    const grp = bot.group; grp.updateMatrixWorld(true); const pieces = [];
    grp.children.forEach((c) => {
      if (!c.isMesh) return; const m = new THREE.Mesh(c.geometry, c.material.clone());
      c.matrixWorld.decompose(m.position, m.quaternion, m.scale); scene.add(m);
      c.geometry.computeBoundingBox(); const bb = c.geometry.boundingBox, sz = bb.getSize(V()).multiply(m.scale);
      pieces.push({ m, size: sz, vol: sz.x * sz.y * sz.z, sphere: c.geometry.type === 'SphereGeometry' });
    });
    grp.visible = false;
    let torso = null; pieces.filter((p) => !p.sphere).forEach((p) => { if (!torso || p.vol > torso.vol) torso = p; });
    let head = pieces.find((p) => p.sphere) || null; if (!torso) torso = pieces[0];
    const q0 = torso.m.quaternion.clone(), qi = q0.clone().invert();
    pieces.forEach((p) => { p.role = p === torso ? 'torso' : p === head ? 'head' : 'limb'; p.off = p.m.position.clone().sub(torso.m.position).applyQuaternion(qi); p.relQ = qi.clone().multiply(p.m.quaternion); p.vel = V(); p.ang = V(); p.rest = Math.max(0.05, Math.min(p.size.x, p.size.y, p.size.z) / 2); });
    return { bot, pieces, torso, head, released: false, t: 0, popped: false, rotLeft: 0, wAxis: V(1, 0, 0), age: 0, scale: 1 };
  }
  const gnd = (x, z) => { const h = opts.getGround ? opts.getGround(x, z) : 0; return Number.isFinite(h) ? h : 0; };
  function releaseRag(r, dir, head, hitPt) {
    r.released = true; const fl = V(dir.x, 0, dir.z); if (fl.lengthSq() < 1e-4) fl.set(0, 0, -1); fl.normalize();
    const t = r.torso; t.vel.copy(fl).multiplyScalar(head ? 5.5 : 6.5).add(V(0, head ? 3.2 : 3.8, 0));
    r.wAxis = UP.clone().cross(fl).normalize(); r.rotLeft = 1.75 + Math.random() * 0.15; r.fall = 5.2;
    r.pieces.forEach((p) => { if (p.role === 'limb') { p.vel.copy(t.vel).multiplyScalar(0.8).add(V((Math.random() - .5) * 2, Math.random() * 2, (Math.random() - .5) * 2)); } });
    if (head && r.head) { r.popped = true; const h = r.head; h.vel.copy(dir).multiplyScalar(5).add(V((Math.random() - .5) * 3, 7.5, (Math.random() - .5) * 3)); h.ang.set(Math.random() * 14 - 7, Math.random() * 14 - 7, Math.random() * 14 - 7); }
    else if (r.head) r.head.vel.copy(t.vel);
  }
  const _q = new THREE.Quaternion(), _v = V(), _tq = new THREE.Quaternion();
  function stepRag(r, dt) {
    r.age += dt; const t = r.torso, g = cfg.gravity;
    if (!r.released) return;
    const n = Math.max(1, Math.ceil(dt / 0.012)), h = dt / n;
    for (let s = 0; s < n; s++) {
      // torso
      t.vel.y -= g * h; t.m.position.addScaledVector(t.vel, h);
      if (r.rotLeft > 0) { const a = Math.min(r.rotLeft, r.fall * h); _q.setFromAxisAngle(r.wAxis, a); t.m.quaternion.premultiply(_q); r.rotLeft -= a; }
      const prog = clamp(r.rotLeft / 1.8, 0, 1); const half = lerp(Math.min(t.size.x, t.size.z) / 2, t.size.y / 2, prog);
      const gy = gnd(t.m.position.x, t.m.position.z);
      if (t.m.position.y - half < gy) { t.m.position.y = gy + half; if (t.vel.y < 0) t.vel.y *= -0.28; const f = Math.max(0, 1 - 7 * h); t.vel.x *= f; t.vel.z *= f; }
      // others
      r.pieces.forEach((p) => {
        if (p === t) return;
        const free = p.role === 'head' && r.popped;
        if (!free) {
          _v.copy(p.off).applyQuaternion(t.m.quaternion).add(t.m.position).sub(p.m.position);
          p.vel.addScaledVector(_v, (p.role === 'head' ? 70 : 90) * h); p.vel.multiplyScalar(Math.max(0, 1 - 7 * h));
          _tq.copy(t.m.quaternion).multiply(p.relQ); p.m.quaternion.slerp(_tq, Math.min(1, 9 * h));
        } else {
          p.vel.y -= g * h; _q.set(p.ang.x * h * 0.5, p.ang.y * h * 0.5, p.ang.z * h * 0.5, 0); const dq = _q.clone().multiply(p.m.quaternion); p.m.quaternion.x += dq.x; p.m.quaternion.y += dq.y; p.m.quaternion.z += dq.z; p.m.quaternion.w += dq.w; p.m.quaternion.normalize();
        }
        p.m.position.addScaledVector(p.vel, h);
        const gy2 = gnd(p.m.position.x, p.m.position.z) + (free ? p.size.x / 2 : p.rest * 0.6);
        if (p.m.position.y < gy2) { p.m.position.y = gy2; if (p.vel.y < 0) p.vel.y *= free ? -0.55 : -0.2; const f = Math.max(0, 1 - (free ? 4 : 8) * h); p.vel.x *= f; p.vel.z *= f; p.ang.multiplyScalar(free ? Math.max(0, 1 - 1.5 * h) : 0); }
      });
    }
    if (r.age > cfg.ragdollLife - 0.6) { r.scale = Math.max(0, (cfg.ragdollLife - r.age) / 0.6); r.pieces.forEach((p) => { p.m.scale.setScalar(0.001 + r.scale); }); }
  }
  function killRag(r) { r.pieces.forEach((p) => { scene.remove(p.m); p.m.material.dispose(); }); }

  // ---------- cinematic ----------
  function shouldCine(sh) {
    const h = sh.hit; if (!cfg.enabled || cine || !h || h.kind !== 'target' || !h.killed) return false;
    if (sh.force) return true; if (clock - lastCineEnd < cfg.cooldown) return false;
    if (h.headshot && cfg.headshotAlways) return true;
    return cfg.bodyKills === 'always' || (cfg.bodyKills === 'far' && sh.dist >= cfg.minDistance);
  }
  function startCine(sh) {
    const Tf = clamp(sh.dist / cfg.flightSpeed, cfg.minFlight, cfg.maxFlight);
    cine = { sh, t: 0, Tf, Ti: cfg.impactTime, To: cfg.outroTime, total: Tf + cfg.impactTime + cfg.outroTime, phase: 'flight', side: null, focus: sh.end.clone(), sideAng: 0, rollSeed: Math.random() * 6.28, sign: Math.random() < 0.5 ? 1 : -1, hasLive: false };
    ui.classList.add('on'); elCap.classList.remove('show');
    camera.children.forEach((c) => { hiddenKids.push([c, c.visible]); c.visible = false; });
    if (opts.hideHud) opts.hideHud(true);
    sfx('whoosh', { dur: Tf + 0.2 });
    startRecording(); if (opts.onStart) opts.onStart({ dist: sh.dist, headshot: !!sh.hit.headshot });
  }
  function enterImpact() {
    const c = cine; c.phase = 'impact'; c.t = Math.max(c.t, c.Tf);
    const sh = c.sh, H = sh.end, dir = sh.dir, right = dir.clone().cross(UP); if (right.lengthSq() < 1e-4) right.set(1, 0, 0); right.normalize();
    // pick the side with most room
    let best = null; for (const s of [1, -1]) for (const a of [0, 0.5]) {
      const side = right.clone().multiplyScalar(s).applyAxisAngle(UP, a * s); const free = freeDist(H, side.clone().add(V(0, 0.15, 0)).normalize(), 4.2);
      if (!best || free > best.free + (s === c.sign ? 0 : 0.4)) best = { side, free };
    }
    c.side = best.side; c.free = best.free; flash(); if (!c.recFlash) c.recFlash = 0;
    elCap.querySelector('b').textContent = sh.hit.headshot ? str().head : str().body;
    elCap.querySelector('i').textContent = Math.round(sh.dist) + ' m';
    elCap.classList.add('show');
    if (opts.onImpact) opts.onImpact({ point: H.clone(), headshot: !!sh.hit.headshot, dist: sh.dist });
    if (rec.on && rec.canvas) rec.canvas.toBlob((bl) => { rec.poster = rec.poster || bl; }, 'image/png');
  }
  function freeDist(from, dir, max) {
    if (!opts.raycast || !opts.colliders) return max;
    const r = opts.raycast({ x: from.x, y: from.y, z: from.z }, { x: dir.x, y: dir.y, z: dir.z }, { colliders: opts.colliders, maxDistance: max });
    return r ? r.distance : max;
  }
  function endCine() {
    const c = cine; cine = null; timeScale = 1; lastCineEnd = clock;
    ui.classList.remove('on'); elCap.classList.remove('show');
    hiddenKids.splice(0).forEach(([o, v]) => { o.visible = v; });
    if (opts.hideHud) opts.hideHud(false);
    stopRecording(); if (opts.onEnd) opts.onEnd({ dist: c.sh.dist });
  }
  function cineScales(c) {
    const t = c.t; let ts, fx;
    if (t < 0.12) { ts = lerp(1, cfg.slowScale, sstep(t / 0.12)); fx = ts; }
    else if (c.phase === 'flight') { ts = cfg.slowScale; fx = cfg.slowScale; }
    else if (c.phase === 'impact') { ts = cfg.impactScale; fx = 0.14; }
    else { const u = (t - c.Tf - c.Ti) / c.To; ts = lerp(cfg.impactScale, cfg.outroScale, sstep(u)); fx = lerp(0.14, 0.4, sstep(u)); if (c.total - t < 0.4) ts = lerp(1, ts, sstep((c.total - t) / 0.4)); }
    return { ts, fx };
  }

  // camera pose computed for the cinematic; written to the camera in applyCamera()
  const _m = new THREE.Matrix4(), _cp = V(), _look = V(), _qq = new THREE.Quaternion(), _qr = new THREE.Quaternion();
  function lookQuat(pos, target, roll) { _m.lookAt(pos, target, UP); const q = new THREE.Quaternion().setFromRotationMatrix(_m); if (roll) q.multiply(_qr.setFromAxisAngle(V(0, 0, 1), roll)); return q; }
  function cinePose(c) {
    const sh = c.sh, t = c.t;
    if (c.phase === 'flight') {
      const u = clamp(t / c.Tf, 0, 1), s = sh.dist * (1 - Math.pow(1 - u, 1.5));
      const bp = sh.muzzle.clone().addScaledVector(sh.dir, s), right = sh.dir.clone().cross(UP).normalize(), upv = right.clone().cross(sh.dir).normalize();
      const ang = u * Math.PI * 1.1 + c.rollSeed, rad = lerp(0.3, 0.75, u), back = lerp(1.5, 2.3, u);
      const pos = bp.clone().addScaledVector(sh.dir, -back).addScaledVector(right, Math.cos(ang) * rad * c.sign).addScaledVector(upv, Math.sin(ang) * rad * 0.7 + 0.15);
      const dB = freeDist(bp, pos.clone().sub(bp).normalize(), pos.distanceTo(bp)); if (dB < pos.distanceTo(bp)) pos.copy(bp).lerp(pos, Math.max(0.15, (dB - 0.15) / pos.distanceTo(bp)));
      const look = bp.clone().addScaledVector(sh.dir, 5); look.lerp(sh.end, u * u);
      return { pos, quat: lookQuat(pos, look, 0.14 * Math.sin(ang * 1.3)), fov: lerp(74, 50, sstep(u)) };
    }
    const pt = t - c.Tf, d0 = lerp(6.2, 4.4, clamp(pt / (c.Ti + c.To), 0, 1));
    const r = sh.rag, tp = r && r.torso ? r.torso.m.position : sh.end;
    const focus = sh.end.clone().lerp(tp, sstep(pt / 0.9)).add(V(0, 0.1, 0)); c.focus.lerp(focus, 0.35);
    const side = c.side.clone().applyAxisAngle(UP, 0.32 * pt * c.sign);
    let d = Math.min(d0, Math.max(1.6, c.free * 0.88)); const sd = side.clone().add(V(0, 0.18 + 0.05 * pt, 0)).normalize();
    const f2 = freeDist(c.focus, sd, d + 0.3); if (f2 < d + 0.3) d = Math.max(1.4, f2 - 0.3);
    const pos = c.focus.clone().addScaledVector(sd, d);
    return { pos, quat: lookQuat(pos, c.focus, 0.04 * Math.sin(pt)), fov: lerp(44, 36, clamp(pt / (c.Ti + c.To), 0, 1)) };
  }

  // ---------- recording ----------
  const rec = { on: false, canvas: null, ctx: null, mr: null, chunks: [], track: null, t0: 0, poster: null, mime: '', caption: null, started: false };
  function pickMime() { const cands = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']; for (const m of cands) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; return ''; }
  function startRecording() {
    if (!cfg.record || !window.MediaRecorder) return; const mime = pickMime(); if (!mime) return;
    const src = renderer.domElement, w = Math.min(cfg.recordWidth, src.width) & ~1, h = Math.round(w * src.height / src.width) & ~1;
    const cv = rec.canvas || document.createElement('canvas'); cv.width = w; cv.height = h; rec.canvas = cv; rec.ctx = cv.getContext('2d');
    try {
      const stream = cv.captureStream(0); rec.track = stream.getVideoTracks()[0];
      rec.mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: cfg.bitrate }); rec.chunks = []; rec.mime = mime; rec.poster = null;
      rec.mr.ondataavailable = (e) => { if (e.data && e.data.size) rec.chunks.push(e.data); };
      rec.mr.start(250); rec.on = true; rec.t0 = clock; rec.started = true; rec.sh = cine.sh;
    } catch (e) { rec.on = false; }
  }
  function stopRecording() {
    if (!rec.on) return; setTimeout(() => {
      rec.on = false; const mr = rec.mr; if (!mr || mr.state === 'inactive') return;
      const dur = clock - rec.t0, sh = rec.sh, mime = rec.mime;
      mr.onstop = () => {
        const blob = new Blob(rec.chunks, { type: mime.split(';')[0] }); const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        if (lastReplay && lastReplay.url) URL.revokeObjectURL(lastReplay.url);
        lastReplay = { blob, url: URL.createObjectURL(blob), mime: blob.type, duration: dur, poster: rec.poster, filename: 'sniper-chill-' + Date.now() + '.' + ext, headshot: !!(sh && sh.hit && sh.hit.headshot), dist: sh ? sh.dist : 0 };
        api.lastReplay = lastReplay; showToast(); if (opts.onReplay) opts.onReplay(lastReplay);
      };
      mr.stop();
    }, 250);
  }
  function drawRec() {
    const g = rec.ctx, w = rec.canvas.width, h = rec.canvas.height, c = cine; if (!g) return;
    g.drawImage(renderer.domElement, 0, 0, w, h);
    if (c) { const bar = Math.round(h * 0.09); g.fillStyle = '#000'; g.fillRect(0, 0, w, bar); g.fillRect(0, h - bar, w, bar);
      if (c.phase !== 'flight' && c.sh.hit) { const hs = c.sh.hit.headshot; g.textAlign = 'center'; g.font = `900 italic ${Math.round(h * 0.11)}px system-ui,sans-serif`; g.lineJoin = 'round'; g.lineWidth = Math.round(h * 0.02); g.strokeStyle = '#ff4fa8'; g.fillStyle = '#fff'; const y = h - bar - h * 0.09; g.strokeText(hs ? str().head : str().body, w / 2, y); g.fillText(hs ? str().head : str().body, w / 2, y); g.font = `700 ${Math.round(h * 0.04)}px system-ui,sans-serif`; g.lineWidth = Math.round(h * 0.008); g.strokeText(Math.round(c.sh.dist) + ' m', w / 2, y + h * 0.055); g.fillText(Math.round(c.sh.dist) + ' m', w / 2, y + h * 0.055); }
    }
    g.textAlign = 'right'; g.font = `900 italic ${Math.round(h * 0.035)}px system-ui,sans-serif`; g.fillStyle = 'rgba(255,255,255,.85)'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 6; g.fillText(cfg.watermark, w - h * 0.03, h - h * 0.03 - (c ? h * 0.09 : 0)); g.shadowBlur = 0;
    if (rec.track && rec.track.requestFrame) rec.track.requestFrame();
    if (opts.onFrame) opts.onFrame(rec.canvas, { t: clock - rec.t0, phase: c ? c.phase : 'tail' });
  }
  function showToast() {
    if (!cfg.toast || !lastReplay) return; const s = str();
    elToast.innerHTML = ''; const v = document.createElement('video'); v.src = lastReplay.url; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; elToast.appendChild(v);
    const lab = document.createElement('span'); lab.textContent = s.ready; elToast.appendChild(lab);
    const b1 = document.createElement('button'); b1.textContent = s.share; b1.onclick = (e) => { e.stopPropagation(); api.share(); };
    const b2 = document.createElement('button'); b2.textContent = s.save; b2.onclick = (e) => { e.stopPropagation(); api.download(); };
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '\u00d7'; x.onclick = (e) => { e.stopPropagation(); elToast.classList.remove('show'); };
    elToast.append(b1, b2, x); elToast.classList.add('show'); clearTimeout(showToast.t); showToast.t = setTimeout(() => elToast.classList.remove('show'), cfg.toastSeconds * 1000);
  }

  // ---------- public ----------
  const api = {
    config: cfg, lastReplay: null, ui,
    get ragdolls() { return ragdolls; }, get active() { return !!cine; }, get timeScale() { return timeScale; }, get phase() { return cine ? cine.phase : null; },
    shoot(s) {
      const muzzle = toV(s.muzzle), end = toV(s.end), dir = end.clone().sub(muzzle), dist = dir.length(); if (dist < 1e-3) return; dir.divideScalar(dist);
      const sh = { muzzle, end, dir, dist, weapon: s.weapon || 'rifle', hit: s.hit || null, force: !!s.force, cine: false, rag: null, arrived: false };
      if (sh.hit && sh.hit.kind === 'target' && sh.hit.killed && sh.hit.bot) sh.rag = makeStandIn(sh.hit.bot), ragdolls.push(sh.rag);
      if (shouldCine(sh)) { sh.cine = true; startCine(sh); }
      spawnBullet(sh); return sh;
    },
    update(realDt) {
      realDt = clamp(realDt, 0, 0.1); clock += realDt;
      if (cine) { cine.t += realDt; const c = cine;
        if (c.phase === 'flight') { const b = bullets.find((x) => x.sh === c.sh); if (b && !b.done) { const u = clamp(c.t / c.Tf, 0, 1); b.s = c.sh.dist * (1 - Math.pow(1 - u, 1.5)); if (u >= 1) b.s = c.sh.dist; } else if (!b) { enterImpact(); } }
        if (c.t >= c.total) endCine(); }
      const sc = cine ? cineScales(cine) : { ts: 1, fx: 1 }; timeScale = sc.ts;
      stepBullets(realDt, realDt * timeScale);
      const fdt = realDt * sc.fx;
      for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= fdt; p.v.y -= p.g * fdt; p.m.position.addScaledVector(p.v, fdt); if (p.spin) { p.m.rotation.x += p.spin.x * fdt; p.m.rotation.y += p.spin.y * fdt; }
        if (p.grow) p.m.scale.multiplyScalar(1 + p.grow * fdt); if (p.shrink) { const k = clamp(p.life / 0.5, 0, 1); p.m.scale.z = p.m.scale.x * 0.3; p.m.visible = k > 0; } if (p.fade) p.m.material.opacity = 0.55 * clamp(p.life / p.max, 0, 1);
        const gy = gnd(p.m.position.x, p.m.position.z); if (p.g > 0 && p.m.position.y < gy + 0.03) { p.m.position.y = gy + 0.03; p.v.set(0, 0, 0); p.spin = null; }
        if (p.life <= 0) { scene.remove(p.m); if (p.fade) p.m.material.dispose(); parts.splice(i, 1); } }
      for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life -= realDt; const k = 1 - r.life / r.max; r.m.scale.setScalar(r.size * (0.15 + 0.85 * Math.sqrt(clamp(k, 0, 1))) * r.grow); r.m.material.opacity = 0.9 * clamp(1 - k, 0, 1); if (r.life <= 0) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); } }
      for (let i = sprites.length - 1; i >= 0; i--) { const s = sprites[i]; s.life -= fdt; const k = 1 - s.life / s.max; const sc2 = s.size * (s.text ? lerp(0.4, 1, sstep(k * 5)) : 1 + s.grow * k); s.s.scale.set(sc2, s.text ? sc2 * 0.31 : sc2, 1); s.s.position.y += s.vy * fdt; s.s.material.opacity = s.op * clamp(s.life / (s.max * 0.5), 0, 1); if (s.life <= 0) { scene.remove(s.s); s.s.material.dispose(); if (s.tex) s.tex.dispose(); sprites.splice(i, 1); } }
      for (let i = ragdolls.length - 1; i >= 0; i--) { const r = ragdolls[i]; if (r.released) stepRag(r, fdt); if (r.age > cfg.ragdollLife) { killRag(r); ragdolls.splice(i, 1); } }
      for (let i = decals.length - 1; i >= 0; i--) { const d = decals[i]; d.life -= realDt; d.m.scale.setScalar(Math.min(0.12 + (d.max - d.life) * 1.5, 0.35)); d.m.material.opacity = 0.55 * clamp(d.life / 2, 0, 1); if (d.life <= 0) { scene.remove(d.m); d.m.material.dispose(); decals.splice(i, 1); } }
      return timeScale;
    },
    applyCamera() {
      if (!cine) return; const c = cine;
      live.pos.copy(camera.position); live.quat.copy(camera.quaternion); live.fov = camera.fov;
      const pose = cinePose(c); let pos = pose.pos, quat = pose.quat, fov = pose.fov;
      const inB = sstep(c.t / 0.3); if (inB < 1) { pos = live.pos.clone().lerp(pos, inB); quat = live.quat.clone().slerp(quat, inB); fov = lerp(live.fov, fov, inB); }
      const outB = c.total - c.t < 0.4 ? sstep(1 - (c.total - c.t) / 0.4) : 0; if (outB > 0) { pos = pos.clone().lerp(live.pos, outB); quat = quat.clone().slerp(live.quat, outB); fov = lerp(fov, live.fov, outB); }
      camera.position.copy(pos); camera.quaternion.copy(quat); camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    },
    afterRender() { if (rec.on) drawRec(); },
    skip() { if (cine) { if (!cine.sh.arrived) { const b = bullets.find((x) => x.sh === cine.sh); if (b) { b.s = b.dist; } } cine.t = cine.total; } },
    clear() { if (cine) { cine.t = cine.total; } [...bullets].forEach((b) => { scene.remove(b.g, b.trail); }); bullets.length = 0; parts.splice(0).forEach((p) => scene.remove(p.m)); rings.splice(0).forEach((r) => scene.remove(r.m)); sprites.splice(0).forEach((s) => scene.remove(s.s)); decals.splice(0).forEach((d) => scene.remove(d.m)); ragdolls.splice(0).forEach(killRag); },
    async share() {
      const r = lastReplay; if (!r) return false; const file = new File([r.blob], r.filename, { type: r.mime });
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Sniper Chill', text: str().shareText + ' ' + location.href }); return true; } } catch (e) { if (e && e.name === 'AbortError') return false; }
      api.download(); return false;
    },
    download() { const r = lastReplay; if (!r) return; const a = document.createElement('a'); a.href = r.url; a.download = r.filename; document.body.appendChild(a); a.click(); a.remove(); },
    dispose() { disposed = true; api.clear(); ui.remove(); if (lastReplay && lastReplay.url) URL.revokeObjectURL(lastReplay.url); },
  };
  return api;
}
