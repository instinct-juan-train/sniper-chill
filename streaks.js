// streaks.js - Sniper Chill killstreaks (UAV, remote missile, RC bomb car, airstrike).
// See STREAKS.md for the integration/event API. Pure ES module, only needs the THREE namespace passed in.

export const DEFAULT_CONFIG = {
  // Streak counter resets on death / start. Each reward is granted once when the counter hits `at`.
  rewards: [
    { id: 'uav', at: 3, key: 'Digit4' },
    { id: 'missile', at: 5, key: 'Digit5' },
    { id: 'rc', at: 7, key: 'Digit6' },
    { id: 'airstrike', at: 9, key: 'Digit7' },
  ],
  callKey: 'KeyG',            // calls the first available reward (in `rewards` order)
  countStreakKills: false,    // do kills made by streaks feed the counter?
  loop: false,                // after the last reward, restart the counter from 0
  selfDamage: false,          // blasts hurt the player (not implemented: reserved)
  names: { uav: 'Radar UAV', missile: 'Misil teledirigido', rc: 'Coche RC bomba', airstrike: 'Ataque aéreo' },
  uav: { duration: 20, alertBots: true, alertRadius: 30 },
  missile: { speed: 50, boost: 90, lifetime: 20, startHeight: 150, startBack: 10, startPitch: -1.1, blastRadius: 9, maxDamage: 140, minDamage: 40, alertBots: true },
  rc: { speed: 10, boost: 17, turnRate: 2.4, lifetime: 25, blastRadius: 6, maxDamage: 130, minDamage: 40, contactRadius: 1.15, engineNoise: true },
  airstrike: { bombs: 6, spacing: 4.5, interval: 0.28, delay: 1.4, blastRadius: 5, maxDamage: 120, minDamage: 40, range: 45 },
};

const CSS = `
.sk{position:absolute;inset:0;pointer-events:none;z-index:22;font-family:Fredoka,system-ui,sans-serif;color:#fff;user-select:none}
.sk .tray{position:absolute;right:12px;top:13%;display:flex;flex-direction:column;gap:9px;align-items:flex-end}
.sk .slot{position:relative;width:52px;height:52px;border-radius:12px;background:rgba(10,14,30,.5);border:2px solid rgba(255,255,255,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;text-shadow:0 2px 0 rgba(0,0,0,.45);transition:transform .15s,background .2s,border-color .2s}
.sk .slot svg{width:24px;height:24px}
.sk .slot .k{position:absolute;top:-7px;left:-7px;background:#ffd166;color:#222;border-radius:7px;padding:0 7px;font-size:12px;line-height:18px;text-shadow:none}
.sk .slot .t{font-size:9px;letter-spacing:.06em;opacity:.9;margin-top:2px}
.sk .slot .n{position:absolute;right:5px;bottom:2px;font-size:13px}
.sk .slot.have{background:rgba(255,209,102,.28);border-color:#ffd166;transform:translateX(-8px) scale(1.12);animation:skp .9s ease-in-out infinite;box-shadow:0 0 14px 2px rgba(255,209,102,.75)}
.sk .slot.act{background:rgba(82,240,160,.35);border-color:#52f0a0}
@keyframes skp{50%{box-shadow:0 0 26px 7px rgba(255,209,102,.95);background:rgba(255,209,102,.55)}}
.sk .streak{position:absolute;right:12px;top:calc(13% - 26px);font-weight:700;font-size:12px;letter-spacing:.14em;text-shadow:0 2px 0 rgba(0,0,0,.55);display:flex;gap:6px;align-items:center}
.sk .streak .pip{display:none}
.sk .pip{width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,.28);border:2px solid rgba(255,255,255,.7)}
.sk .pip.on{background:#ffd166;border-color:#fff}.sk .pip.mark{border-color:#ffd166;border-radius:3px}
.sk .banner{position:absolute;left:50%;top:15%;transform:translate(-50%,0) scale(.8);text-align:center;opacity:0;text-shadow:0 3px 0 rgba(0,0,0,.5);transition:opacity .25s,transform .25s}
.sk .banner.on{opacity:1;transform:translate(-50%,0) scale(1)}
.sk .banner b{display:block;font-size:clamp(20px,3vw,32px);letter-spacing:.06em;color:#ffd166}
.sk .banner span{font-size:clamp(13px,1.7vw,18px);font-weight:700}
.sk .mini{position:absolute;left:16px;top:16px;width:150px;height:150px;border-radius:50%;border:3px solid rgba(255,255,255,.7);background:rgba(20,40,60,.55);display:none;overflow:hidden;box-shadow:0 0 0 3px rgba(0,0,0,.25)}
.sk .minilab{position:absolute;left:16px;top:172px;width:156px;text-align:center;font-weight:800;font-size:13px;letter-spacing:.1em;text-shadow:0 2px 0 rgba(0,0,0,.5);display:none}
.sk .ctl{position:absolute;inset:0;display:none}
.sk .ctl.on{display:block}
.sk .ctl.rc .ret{display:none}
.sk.ctrl .tray,.sk.ctrl .streak{display:none}
.sk .vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(10,20,40,.72) 100%)}
.sk .scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.045) 0 2px,transparent 2px 5px);mix-blend-mode:screen}
.sk .ret{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border:3px solid #ffd166;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.3)}
.sk .ret:before,.sk .ret:after{content:'';position:absolute;background:#ffd166}.sk .ret:before{left:50%;top:-12px;width:3px;height:78px;margin-left:-1.5px}.sk .ret:after{top:50%;left:-12px;height:3px;width:78px;margin-top:-1.5px}
.sk .ret i{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(10,20,40,.0)}
.sk .rd{position:absolute;left:50%;transform:translateX(-50%);font-weight:800;text-shadow:0 2px 0 rgba(0,0,0,.6);text-align:center}
.sk .rd.top{top:92px;font-size:18px;letter-spacing:.12em}.sk .rd.bot{bottom:26px;font-size:14px;opacity:.95}
.sk .bar{position:absolute;left:50%;top:122px;width:220px;height:10px;transform:translateX(-50%);border-radius:8px;background:rgba(10,14,30,.55);border:2px solid rgba(255,255,255,.6);overflow:hidden}
.sk .bar i{display:block;height:100%;background:#ffd166;width:100%}
`;
const ICON = {
  uav: '<svg viewBox="0 0 32 32" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><circle cx="16" cy="16" r="3" fill="#fff"/><path d="M8 16a8 8 0 0 1 8-8M4 16A12 12 0 0 1 16 4M24 16a8 8 0 0 1-8 8M28 16a12 12 0 0 1-12 12"/></svg>',
  missile: '<svg viewBox="0 0 32 32" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"><path d="M16 3l5 8v12h-10V11z"/><path d="M11 18l-5 8h5zM21 18l5 8h-5z"/></svg>',
  rc: '<svg viewBox="0 0 32 32" fill="#fff"><rect x="5" y="13" width="22" height="8" rx="3"/><circle cx="10" cy="23" r="3.2"/><circle cx="22" cy="23" r="3.2"/><rect x="15" y="6" width="2.4" height="8"/><circle cx="16.2" cy="5" r="2.2"/></svg>',
  airstrike: '<svg viewBox="0 0 32 32" fill="#fff"><path d="M16 3l3 5h-6zM7 12l3 5H4zM25 12l3 5h-6zM16 20l3 5h-6z"/><rect x="15" y="8" width="2" height="9"/></svg>',
};
const mm = (v, a, b) => Math.max(a, Math.min(b, v));
const dirOf = (yaw, pitch) => { const c = Math.cos(pitch); return { x: -Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c }; };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const merge = (a, b) => { const o = { ...a }; for (const k in (b || {})) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k]) ? merge(a[k], b[k]) : b[k]; return o; };

/**
 * ctx: { THREE, scene, camera, root, ctrl, bots, map, world, raycast, play, vm?, config?,
 *        damageBot?(bot, amount, meta)->bool, onKill?({bot,source,streakId}), isPlaying?()->bool }
 */
export function createStreaks(ctx) {
  const { THREE, scene, camera, root, ctrl, bots, map, raycast } = ctx;
  const play = ctx.play || (() => {});
  const cfg = merge(DEFAULT_CONFIG, ctx.config);
  const world = ctx.world || [];
  const listeners = {};
  const emit = (n, d) => { for (const f of (listeners[n] || [])) { try { f(d); } catch (e) { console.error(e); } } for (const f of (listeners['*'] || [])) { try { f(n, d); } catch (e) { console.error(e); } } };
  const S = { cfg, count: 0, inv: {}, active: null, uav: null, fx: [], strikes: [], shake: 0, enabled: true };
  const keys = new Set();
  const mouseDown = { l: false };
  const look = { dx: 0, dy: 0 };

  // ---------- DOM ----------
  if (!document.getElementById('sk-css')) { const s = document.createElement('style'); s.id = 'sk-css'; s.textContent = CSS; document.head.appendChild(s); }
  const dom = document.createElement('div'); dom.className = 'sk'; root.appendChild(dom);
  dom.innerHTML = `<canvas class="mini" width="300" height="300"></canvas><div class="minilab"></div><div class="streak"></div><div class="tray"></div><div class="banner"><b></b><span></span></div>
  <div class="ctl"><div class="vig"></div><div class="scan"></div><div class="ret"><i></i></div><div class="rd top"></div><div class="bar"><i></i></div><div class="rd bot"></div></div>`;
  const $ = (s) => dom.querySelector(s);
  const mini = $('.mini'), minilab = $('.minilab'), streakEl = $('.streak'), tray = $('.tray'), banner = $('.banner'), ctl = $('.ctl'), rdTop = $('.rd.top'), rdBot = $('.rd.bot'), barI = $('.bar i');
  const slots = {};
  for (const r of cfg.rewards) {
    const el = document.createElement('div'); el.className = 'slot';
    el.innerHTML = `<span class="k">${r.key.replace('Digit', '').replace('Key', '')}</span>${ICON[r.id] || ''}<span class="t">${r.at} bajas</span><span class="n"></span>`;
    tray.appendChild(el); slots[r.id] = el;
  }
  let bannerT = 0;
  function showBanner(title, sub, t = 2.2) { banner.querySelector('b').textContent = title; banner.querySelector('span').textContent = sub || ''; banner.classList.add('on'); bannerT = t; }
  function refreshHud() {
    const max = Math.max(...cfg.rewards.map((r) => r.at));
    let h = `<span>RACHA ${S.count}</span>`;
    for (let i = 1; i <= max; i++) h += `<i class="pip${i <= S.count ? ' on' : ''}${cfg.rewards.some((r) => r.at === i) ? ' mark' : ''}"></i>`;
    streakEl.innerHTML = h;
    for (const r of cfg.rewards) {
      const n = S.inv[r.id] || 0, el = slots[r.id];
      el.classList.toggle('have', n > 0); el.classList.toggle('act', S.active && S.active.id === r.id || (r.id === 'uav' && !!S.uav));
      el.querySelector('.n').textContent = n > 1 ? '×' + n : '';
    }
  }

  // ---------- shared FX ----------
  const geo = { ico: new THREE.IcosahedronGeometry(1, 1), ring: new THREE.TorusGeometry(1, 0.06, 6, 28), box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), cone: new THREE.ConeGeometry(0.5, 1, 10), sph: new THREE.SphereGeometry(1, 10, 8) };
  const mat = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, ...o });
  const addFx = (obj, life, fn) => { scene.add(obj); S.fx.push({ obj, t: 0, life, fn }); };
  function explosionFx(p, r) {
    const shell = new THREE.Mesh(geo.ico, mat(0xffb15a)); shell.position.set(p.x, p.y, p.z);
    addFx(shell, 0.55, (k) => { const s = r * (0.25 + 0.75 * Math.sqrt(k)); shell.scale.setScalar(s); shell.material.opacity = 0.9 * (1 - k); });
    const core = new THREE.Mesh(geo.ico, mat(0xfff4cf)); core.position.copy(shell.position);
    addFx(core, 0.3, (k) => { core.scale.setScalar(r * 0.45 * (1 + k)); core.material.opacity = 1 - k; });
    const ring = new THREE.Mesh(geo.ring, mat(0xffffff)); ring.position.set(p.x, p.y + 0.15, p.z); ring.rotation.x = Math.PI / 2;
    addFx(ring, 0.6, (k) => { ring.scale.setScalar(r * 1.15 * k + 0.3); ring.material.opacity = 0.8 * (1 - k); });
    const cols = [0xff8fb1, 0xffd166, 0x9ad1ff, 0x52f0a0, 0xffffff];
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Mesh(geo.box, mat(cols[i % cols.length])); const a = Math.random() * 6.28, up = 4 + Math.random() * 6, sp = (0.3 + Math.random()) * r * 0.9;
      c.scale.setScalar(0.16 + Math.random() * 0.14); c.position.set(p.x, p.y + 0.3, p.z);
      const vx = Math.cos(a) * sp, vz = Math.sin(a) * sp; let vy = up;
      const st = { x: p.x, y: p.y + 0.3, z: p.z };
      addFx(c, 0.9, (k, dt) => { st.x += vx * dt; st.z += vz * dt; vy -= 18 * dt; st.y = Math.max(0.05, st.y + vy * dt); c.position.set(st.x, st.y, st.z); c.rotation.x += dt * 6; c.rotation.y += dt * 5; c.material.opacity = 1 - k * k; });
    }
  }
  function marker(p, r, color, life) {
    const g = new THREE.Group(); g.position.set(p.x, p.y + 0.12, p.z);
    const rg = new THREE.Mesh(geo.ring, mat(color)); rg.rotation.x = Math.PI / 2; rg.scale.setScalar(r); g.add(rg);
    const col = new THREE.Mesh(geo.cyl, mat(color, { opacity: 0.25 })); col.scale.set(0.5, 30, 0.5); col.position.y = 15; g.add(col);
    addFx(g, life, (k) => { rg.scale.setScalar(r * (1.1 - 0.25 * Math.sin(k * 40))); col.material.opacity = 0.18 + 0.15 * Math.sin(k * 60); });
  }

  // ---------- damage ----------
  const center = (b) => ({ x: b.position.x, y: b.position.y + 0.9, z: b.position.z });
  function damageBot(bot, amount, meta) {
    if (ctx.damageBot) return ctx.damageBot(bot, amount, meta);
    const hp = bot.health; bots.damage(bot, Math.max(0, hp - amount), false); return !bot.alive;
  }
  function explode(p, o) {
    const { radius, maxDamage, minDamage, source } = o;
    play('bomb_explode', p); explosionFx(p, radius);
    const pc = ctrl.state.position, dp = Math.hypot(pc.x - p.x, pc.y - p.y, pc.z - p.z);
    S.shake = Math.max(S.shake, mm(1 - dp / 40, 0, 1));
    emit('explosion', { position: { ...p }, radius, source });
    const hits = [];
    for (const b of bots.list) {
      if (!b.alive) continue;
      const c = center(b), d = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z);
      if (d > radius) continue;
      let amount = maxDamage + (minDamage - maxDamage) * (d / radius);
      const dir = { x: c.x - p.x, y: c.y - p.y, z: c.z - p.z };
      const h = d > 0.6 ? raycast({ x: p.x, y: p.y + 0.4, z: p.z }, dir, { colliders: world, maxDistance: d }) : null;
      if (h && h.kind === 'world' && h.distance < d - 0.4) amount *= 0.4; // sheltered behind cover
      const killed = damageBot(b, amount, { source, position: p });
      hits.push(b);
      emit('damage', { bot: b, amount, killed, source, position: { ...p } });
      if (killed) { emit('kill', { bot: b, source, streakId: source }); if (ctx.onKill) ctx.onKill({ bot: b, source, streakId: source }); if (cfg.countStreakKills) bump(); }
    }
    if (bots.noise && o.alert !== false) bots.noise(p.x, p.z, radius * 4);
    return hits;
  }

  // ---------- earning ----------
  function bump() {
    S.count++;
    const maxAt = Math.max(...cfg.rewards.map((r) => r.at));
    for (const r of cfg.rewards) if (r.at === S.count) {
      S.inv[r.id] = (S.inv[r.id] || 0) + 1; play('headshot');
      showBanner(`${cfg.names[r.id] || r.id} listo`, `Racha de ${S.count} · pulsa ${r.key.replace('Digit', '').replace('Key', '')} (o ${cfg.callKey.replace('Key', '')})`);
      emit('earned', { id: r.id, at: r.at, count: S.count });
    }
    emit('progress', { count: S.count });
    if (cfg.loop && S.count >= maxAt) S.count = 0;
    refreshHud();
  }

  // ---------- UAV ----------
  const uavMarks = new Map();
  const mctx = mini.getContext('2d');
  function startUav() {
    S.uav = { t: cfg.uav.duration, total: cfg.uav.duration };
    mini.style.display = 'block'; minilab.style.display = 'block';
    if (cfg.uav.alertBots && bots.noise) { const p = ctrl.state.position; bots.noise(p.x, p.z, cfg.uav.alertRadius); }
    emit('uavStart', { duration: cfg.uav.duration });
  }
  function stopUav(reason) {
    if (!S.uav) return; S.uav = null; mini.style.display = 'none'; minilab.style.display = 'none';
    for (const [, m] of uavMarks) { scene.remove(m.g); } uavMarks.clear();
    emit('ended', { id: 'uav', reason }); refreshHud();
  }
  function updateUav(dt) {
    S.uav.t -= dt; if (S.uav.t <= 0) return stopUav('timeout');
    const live = new Set();
    for (const b of bots.list) {
      if (!b.alive) continue; live.add(b);
      let m = uavMarks.get(b);
      if (!m) {
        const g = new THREE.Group();
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.8, 1.9, 0.8)), new THREE.LineBasicMaterial({ color: 0xff5a7a, depthTest: false, transparent: true }));
        e.position.y = 0.95; e.renderOrder = 999;
        const fill = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.9, 0.8), new THREE.MeshBasicMaterial({ color: 0xff5a7a, depthTest: false, transparent: true, opacity: 0.28, depthWrite: false })); fill.position.y = 0.95; fill.renderOrder = 998; g.add(fill);
        const tri = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.55, 3), new THREE.MeshBasicMaterial({ color: 0xff5a7a, depthTest: false, transparent: true })); tri.rotation.x = Math.PI; tri.renderOrder = 999; tri.position.y = 2.4;
        g.add(e, tri); scene.add(g); m = { g, tri }; uavMarks.set(b, m);
      }
      m.g.position.set(b.position.x, b.position.y, b.position.z); m.tri.position.y = 2.4 + Math.sin(performance.now() / 180) * 0.12;
    }
    for (const [b, m] of uavMarks) if (!live.has(b)) { scene.remove(m.g); uavMarks.delete(b); }
    drawMini(); minilab.textContent = `UAV ${fmt(S.uav.t)} · ${live.size} enemigos`;
  }
  function drawMini() {
    const c = mctx, W = 300, R = 150, scale = R / 34, st = ctrl.state;
    c.clearRect(0, 0, W, W); c.fillStyle = 'rgba(30,60,90,.35)'; c.fillRect(0, 0, W, W);
    c.save(); c.translate(R, R);
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2; for (const r of [R * 0.33, R * 0.66, R * 0.98]) { c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.stroke(); }
    const sweep = (performance.now() / 900) % 6.283; c.fillStyle = 'rgba(120,255,190,.14)'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, sweep - 0.5, sweep); c.fill();
    c.rotate(st.yaw); // up = player facing
    // world blocks
    c.fillStyle = 'rgba(255,255,255,.28)';
    for (const b of (map.colliders || [])) {
      const w = b.max.x - b.min.x, d = b.max.z - b.min.z; if (w > 14 || d > 14) { /* long wall */ }
      const cx = (b.min.x + b.max.x) / 2 - st.position.x, cz = (b.min.z + b.max.z) / 2 - st.position.z;
      if (Math.abs(cx) > 36 || Math.abs(cz) > 36) continue; if (b.max.y - b.min.y < 0.8) continue;
      c.save(); c.rotate(0); c.fillRect((cx - w / 2) * scale, (cz - d / 2) * scale, w * scale, d * scale); c.restore();
    }
    for (const b of bots.list) {
      if (!b.alive) continue; const dx = b.position.x - st.position.x, dz = b.position.z - st.position.z;
      let x = dx * scale, y = dz * scale; const dd = Math.hypot(x, y), lim = R - 10; if (dd > lim) { x *= lim / dd; y *= lim / dd; }
      c.fillStyle = '#ff5a7a'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 7, 0, 6.283); c.fill(); c.stroke();
    }
    c.restore(); c.save(); c.translate(R, R); c.fillStyle = '#52f0a0'; c.beginPath(); c.moveTo(0, -10); c.lineTo(8, 9); c.lineTo(-8, 9); c.closePath(); c.fill(); c.restore();
  }
  // NOTE: minimap rotates with the player (up = facing). x-axis mirror: three.js +x is right when yaw=0 and facing -z, matches canvas (+x right, +z down).

  // ---------- controlled streaks (missile / rc) ----------
  function beginControl(kind, savedView) {
    const st = ctrl.state;
    S.saved = { pos: { x: st.position.x, y: st.position.y, z: st.position.z }, yaw: ctrl.getYaw ? ctrl.getYaw() : st.yaw, pitch: st.pitch, fov: camera.fov };
    ctrl.setEnabled(false); if (ctx.vm) ctx.vm.group.visible = false;
    ctl.classList.toggle('rc', kind === 'rc'); ctl.classList.add('on'); dom.classList.add('ctrl'); emit('takeover', { active: true, kind });
  }
  function endControl(kind, reason) {
    const sv = S.saved; S.active = null; ctl.classList.remove('on'); dom.classList.remove('ctrl');
    if (sv) { ctrl.teleport(sv.pos, { yaw: sv.yaw, pitch: sv.pitch }); }
    ctrl.setEnabled(true); if (ctx.vm) ctx.vm.group.visible = true; camera.fov = sv ? sv.fov : 75; camera.updateProjectionMatrix();
    S.saved = null; emit('takeover', { active: false, kind }); emit('ended', { id: kind, reason }); refreshHud();
  }

  // --- missile ---
  function startMissile() {
    const c = cfg.missile, st = ctrl.state;
    beginControl('missile');
    const yaw = S.saved.yaw, f = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    const pos = new THREE.Vector3(st.eye.x - f.x * c.startBack, st.eye.y + c.startHeight, st.eye.z - f.z * c.startBack);
    const g = new THREE.Mesh(geo.ring, mat(0xff5a7a)); g.rotation.x = Math.PI / 2; scene.add(g);
    S.active = { id: 'missile', pos, yaw, pitch: c.startPitch, t: c.lifetime, speed: c.speed, ring: g, grace: 0.35 };
    play('bomb_beep'); showBanner('Misil en camino', 'Ratón: dirigir · clic: acelerar · Espacio: detonar', 2.2);
    emit('called', { id: 'missile' });
  }
  function updateMissile(dt) {
    const a = S.active, c = cfg.missile;
    a.yaw -= look.dx * 0.0022; a.pitch = mm(a.pitch - look.dy * 0.0022, -1.5, -0.12); look.dx = look.dy = 0;
    const boosting = mouseDown.l || keys.has('ShiftLeft'); a.speed += ((boosting ? c.boost : c.speed) - a.speed) * Math.min(1, dt * 4);
    a.t -= dt; a.grace -= dt;
    const d = dirOf(a.yaw, a.pitch), step = a.speed * dt + 0.2, o = { x: a.pos.x, y: a.pos.y, z: a.pos.z };
    const h = raycast(o, d, { colliders: world, targets: bots.list, maxDistance: step });
    const det = a.grace <= 0 && (keys.has('Space') || keys.has('KeyE'));
    // impact preview ring
    const pr = raycast(o, d, { colliders: world, maxDistance: 120 });
    if (pr) { a.ring.visible = true; a.ring.position.set(pr.point.x, pr.point.y + 0.15, pr.point.z); a.ring.scale.setScalar(c.blastRadius * (0.9 + 0.1 * Math.sin(performance.now() / 120))); } else a.ring.visible = false;
    if (h || det || a.t <= 0 || a.pos.y < 0.2) {
      const p = h ? h.point : { x: a.pos.x, y: Math.max(0.2, a.pos.y), z: a.pos.z };
      scene.remove(a.ring); explode({ x: p.x, y: p.y, z: p.z }, { radius: c.blastRadius, maxDamage: c.maxDamage, minDamage: c.minDamage, source: 'missile', alert: c.alertBots });
      a.pos.set(p.x, p.y + 0.4, p.z); S.cam = { pos: a.pos.clone(), yaw: a.yaw, pitch: a.pitch, t: 0.9 }; // brief aftermath camera
      S.finish = { kind: 'missile', t: 0.9 }; S.active = null; return;
    }
    a.pos.x += d.x * a.speed * dt; a.pos.y += d.y * a.speed * dt; a.pos.z += d.z * a.speed * dt;
    const alt = Math.max(0, Math.round(a.pos.y * 3.28)); rdTop.textContent = `MISIL · ALT ${alt} m`; barI.style.width = mm(a.t / c.lifetime, 0, 1) * 100 + '%';
    rdBot.textContent = 'Ratón dirigir · clic acelerar · Espacio/E detonar';
    camera.position.copy(a.pos); camera.rotation.set(a.pitch, a.yaw, Math.sin(performance.now() / 700) * 0.035, 'YXZ'); camera.fov = 78 + (a.speed - c.speed) * 0.5; camera.updateProjectionMatrix();
  }

  // --- RC car ---
  function carMesh() {
    const g = new THREE.Group(), m = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const body = new THREE.Mesh(geo.box, m(0xff8fb1)); body.scale.set(0.7, 0.28, 1.1); body.position.y = 0.32; g.add(body);
    const cab = new THREE.Mesh(geo.box, m(0xffd166)); cab.scale.set(0.5, 0.22, 0.45); cab.position.set(0, 0.55, 0.1); g.add(cab);
    for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.4], [0.38, 0.4]]) { const w = new THREE.Mesh(geo.cyl, m(0x2f3550)); w.rotation.z = Math.PI / 2; w.scale.set(0.34, 0.14, 0.34); w.position.set(x, 0.17, z); g.add(w); }
    const an = new THREE.Mesh(geo.cyl, m(0xffffff)); an.scale.set(0.03, 0.6, 0.03); an.position.set(0.22, 0.85, 0.4); g.add(an);
    const tip = new THREE.Mesh(geo.sph, m(0xff5a7a)); tip.scale.setScalar(0.07); tip.position.set(0.22, 1.15, 0.4); g.add(tip);
    const bomb = new THREE.Mesh(geo.box, m(0x333a55)); bomb.scale.set(0.4, 0.2, 0.35); bomb.position.set(0, 0.5, 0.42); g.add(bomb);
    return g;
  }
  function blockedAt(x, z, y, r) {
    const h = map.getHeight(x, z); if (!isFinite(h) || h - y > 0.55) return true;
    for (const b of (map.colliders || [])) {
      if (b.max.y < y + 0.12 || b.min.y > y + 0.5) continue;
      const cx = mm(x, b.min.x, b.max.x), cz = mm(z, b.min.z, b.max.z);
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
    }
    return false;
  }
  function startRc() {
    const c = cfg.rc, st = ctrl.state;
    beginControl('rc');
    const yaw = S.saved.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let x = st.position.x + fx * 1.4, z = st.position.z + fz * 1.4, y = st.position.y;
    if (blockedAt(x, z, y, 0.45)) { x = st.position.x; z = st.position.z; }
    const mesh = carMesh(); scene.add(mesh);
    S.active = { id: 'rc', x, z, y: map.getHeight(x, z), yaw, v: 0, t: c.lifetime, mesh, noiseT: 0, grace: 0.4 };
    play('bomb_beep'); showBanner('Coche RC', 'WASD conducir · Shift turbo · Espacio/clic detonar', 2.2);
    emit('called', { id: 'rc' });
  }
  function updateRc(dt) {
    const a = S.active, c = cfg.rc; a.t -= dt; a.grace -= dt; look.dx = look.dy = 0;
    const fw = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const sr = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
    const top = (keys.has('ShiftLeft') ? c.boost : c.speed) * (fw < 0 ? 0.55 : 1);
    a.v += ((fw * top) - a.v) * Math.min(1, dt * (fw ? 3.5 : 2.2));
    a.yaw += sr * c.turnRate * dt * mm(a.v / 4, -1, 1);
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), mx = fx * a.v * dt, mz = fz * a.v * dt;
    let moved = false;
    if (!blockedAt(a.x + mx, a.z, a.y, 0.45)) { a.x += mx; moved = true; } else a.v *= 0.5;
    if (!blockedAt(a.x, a.z + mz, a.y, 0.45)) { a.z += mz; moved = true; } else a.v *= 0.5;
    const th = map.getHeight(a.x, a.z); if (isFinite(th)) a.y += (th - a.y) * Math.min(1, dt * 14);
    a.mesh.position.set(a.x, a.y, a.z); a.mesh.rotation.y = a.yaw; a.mesh.rotation.z = -sr * 0.12 * mm(a.v / 8, 0, 1);
    a.noiseT -= dt; if (c.engineNoise && bots.noise && a.noiseT <= 0 && Math.abs(a.v) > 3) { bots.noise(a.x, a.z, 14); a.noiseT = 2; }
    // contact / detonate
    let touch = false;
    for (const b of bots.list) { if (b.alive && Math.hypot(b.position.x - a.x, b.position.z - a.z) < c.contactRadius && Math.abs(b.position.y - a.y) < 1.6) touch = true; }
    const det = a.grace <= 0 && (keys.has('Space') || keys.has('KeyE') || mouseDown.l);
    if (touch || det || a.t <= 0) {
      const p = { x: a.x, y: a.y + 0.4, z: a.z }; scene.remove(a.mesh);
      explode(p, { radius: c.blastRadius, maxDamage: c.maxDamage, minDamage: c.minDamage, source: 'rc' });
      S.cam = { pos: new THREE.Vector3(a.x - fx * 3.2, a.y + 1.8, a.z - fz * 3.2), yaw: a.yaw, pitch: -0.28, t: 0.9 }; S.finish = { kind: 'rc', t: 0.9 }; S.active = null; return;
    }
    const cp = new THREE.Vector3(a.x - fx * 2.7, a.y + 1.15, a.z - fz * 2.7);
    camera.position.copy(cp); camera.rotation.set(-0.14, a.yaw, -sr * 0.03, 'YXZ'); camera.fov = 82 + Math.abs(a.v) * 0.5; camera.updateProjectionMatrix();
    rdTop.textContent = `COCHE RC · ${Math.max(0, a.t).toFixed(0)} s`; barI.style.width = mm(a.t / c.lifetime, 0, 1) * 100 + '%';
    rdBot.textContent = 'WASD conducir · Shift turbo · Espacio/E/clic detonar';
  }

  // --- airstrike ---
  function startAirstrike() {
    const c = cfg.airstrike, st = ctrl.state, yaw = ctrl.state.yaw, d = dirOf(yaw, st.pitch);
    const h = raycast(st.eye, d, { colliders: world, maxDistance: c.range });
    const tp = h ? h.point : { x: st.eye.x + d.x * c.range, y: 0, z: st.eye.z + d.z * c.range };
    const ty = isFinite(map.getHeight(tp.x, tp.z)) ? map.getHeight(tp.x, tp.z) : 0;
    const fwd = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    marker({ x: tp.x, y: ty, z: tp.z }, 2.2, 0xff5a7a, c.delay + c.bombs * c.interval + 0.8);
    S.strikes.push({ t: -c.delay, i: 0, tp: { x: tp.x, y: ty, z: tp.z }, fwd, drops: [] });
    play('bomb_beep'); showBanner('Ataque aéreo', 'Marcado donde apuntabas. ¡Aléjate de la zona!', 2.2);
    emit('called', { id: 'airstrike', target: { ...tp } });
    refreshHud();
  }
  function updateStrikes(dt) {
    const c = cfg.airstrike;
    for (let k = S.strikes.length - 1; k >= 0; k--) {
      const s = S.strikes[k]; s.t += dt;
      while (s.i < c.bombs && s.t >= s.i * c.interval) {
        const off = (s.i - (c.bombs - 1) / 2) * c.spacing, bx = s.tp.x + s.fwd.x * off, bz = s.tp.z + s.fwd.z * off;
        const gy = isFinite(map.getHeight(bx, bz)) ? map.getHeight(bx, bz) : 0;
        const m = new THREE.Mesh(geo.cone, new THREE.MeshLambertMaterial({ color: 0x333a55, flatShading: true })); m.scale.set(0.5, 1.2, 0.5); m.rotation.x = Math.PI; scene.add(m);
        s.drops.push({ m, x: bx, z: bz, gy, y: gy + 40, t: 0 }); s.i++; play('bomb_beep', { x: bx, y: gy, z: bz });
      }
      for (let j = s.drops.length - 1; j >= 0; j--) {
        const d = s.drops[j]; d.t += dt; d.y -= (30 + d.t * 60) * dt; d.m.position.set(d.x, d.y, d.z);
        if (d.y <= d.gy + 0.2) { scene.remove(d.m); s.drops.splice(j, 1); explode({ x: d.x, y: d.gy + 0.3, z: d.z }, { radius: c.blastRadius, maxDamage: c.maxDamage, minDamage: c.minDamage, source: 'airstrike' }); }
      }
      if (s.i >= c.bombs && !s.drops.length) { S.strikes.splice(k, 1); emit('ended', { id: 'airstrike', reason: 'done' }); }
    }
  }

  // ---------- API ----------
  function call(id) {
    if (!S.enabled || (S.active || S.finish) && id !== 'uav') return false;
    if (id === 'uav' && S.uav) return false;
    if (!(S.inv[id] > 0)) return false;
    S.inv[id]--; look.dx = look.dy = 0;
    if (id === 'uav') { startUav(); emit('called', { id }); showBanner('UAV activo', `Enemigos revelados ${cfg.uav.duration} s`, 1.8); }
    else if (id === 'missile') startMissile(); else if (id === 'rc') startRc(); else if (id === 'airstrike') startAirstrike();
    else return false;
    refreshHud(); return true;
  }
  function cancel(reason = 'cancel') {
    if (S.active) { const k = S.active.id; if (S.active.mesh) scene.remove(S.active.mesh); if (S.active.ring) scene.remove(S.active.ring); endControl(k, reason); }
    if (S.finish) { S.finish = null; S.cam = null; endControl(S.finishKind || 'unknown', reason); }
    stopUav(reason);
    for (const s of S.strikes) for (const d of s.drops) scene.remove(d.m); S.strikes.length = 0;
  }
  function reset(full = true) { cancel('reset'); S.count = 0; if (full) S.inv = {}; for (const f of S.fx) scene.remove(f.obj); S.fx.length = 0; refreshHud(); }
  function registerKill(info = {}) { bump(); emit('playerKill', info); }
  function registerDeath() { cancel('death'); S.count = 0; S.inv = {}; refreshHud(); emit('reset', { reason: 'death' }); }
  function update(dt) {
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) banner.classList.remove('on'); }
    for (let i = S.fx.length - 1; i >= 0; i--) { const f = S.fx[i]; f.t += dt; const k = Math.min(1, f.t / f.life); f.fn(k, dt); if (k >= 1) { scene.remove(f.obj); S.fx.splice(i, 1); } }
    if (S.uav) updateUav(dt);
    updateStrikes(dt);
    if (S.active) {
      ctrl.setEnabled(false); S.finishKind = S.active.id;
      if (S.active.id === 'missile') updateMissile(dt); else if (S.active.id === 'rc') updateRc(dt);
    } else if (S.finish) {
      ctrl.setEnabled(false); S.finish.t -= dt; const c = S.cam;
      if (c) { camera.position.copy(c.pos); camera.rotation.set(c.pitch, c.yaw, 0, 'YXZ'); }
      if (S.finish.t <= 0) { const k = S.finish.kind; S.finish = null; S.cam = null; endControl(k, 'detonated'); }
    }
    if (S.shake > 0.01) { camera.position.x += (Math.random() - 0.5) * S.shake * 0.25; camera.position.y += (Math.random() - 0.5) * S.shake * 0.25; S.shake *= Math.pow(0.02, dt); }
  }
  // inputs
  const onKey = (e) => {
    if (ctx.isPlaying && !ctx.isPlaying()) return;
    if (e.type === 'keyup') { keys.delete(e.code); return; }
    if (e.repeat) return; keys.add(e.code);
    if (S.active) { if (['Space', 'KeyE', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault(); return; }
    for (const r of cfg.rewards) if (e.code === r.key) call(r.id);
    if (e.code === cfg.callKey) { const r = cfg.rewards.find((q) => S.inv[q.id] > 0 && !(q.id === 'uav' && S.uav)); if (r) call(r.id); }
  };
  const onMove = (e) => { if (S.active) { look.dx += e.movementX || 0; look.dy += e.movementY || 0; } };
  const onDown = (e) => { if (e.button === 0) mouseDown.l = true; };
  const onUp = (e) => { if (e.button === 0) mouseDown.l = false; };
  document.addEventListener('keydown', onKey, true); document.addEventListener('keyup', onKey, true); document.addEventListener('mousemove', onMove);
  document.addEventListener('mousedown', onDown, true); document.addEventListener('mouseup', onUp, true);
  window.addEventListener('blur', () => { keys.clear(); mouseDown.l = false; });

  refreshHud();
  Object.defineProperties(S, {
    controlling: { get: () => !!(S.active || S.finish) },
    cameraOverride: { get: () => !!(S.active || S.finish) },
    activeKind: { get: () => S.active ? S.active.id : S.finish ? S.finish.kind : null },
    uavActive: { get: () => !!S.uav },
  });
  return Object.assign(S, {
    on(n, f) { (listeners[n] = listeners[n] || []).push(f); return () => this.off(n, f); },
    off(n, f) { listeners[n] = (listeners[n] || []).filter((x) => x !== f); },
    grant(id, n = 1) { S.inv[id] = (S.inv[id] || 0) + n; refreshHud(); },
    call, cancel, reset, update, registerKill, registerDeath, explode, show: (v) => { dom.style.display = v ? '' : 'none'; },
    dispose() { cancel('dispose'); document.removeEventListener('keydown', onKey, true); document.removeEventListener('keyup', onKey, true); document.removeEventListener('mousemove', onMove); document.removeEventListener('mousedown', onDown, true); document.removeEventListener('mouseup', onUp, true); dom.remove(); },
  });
}
