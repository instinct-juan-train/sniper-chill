// game.js - Sniper Chill: wires map, movement, hitscan, player/weapons, audio and bots together.
import * as THREE from './three.module.min.js';
import { buildMap } from './map.js';
import { createController } from './movement.js';
import { raycast } from './hitscan.js';
import { createViewmodels, createWeaponSystem, createHUD, createPlayerState, applyDamage, WEAPON_ORDER } from './player.js';
import { initAudio, play, setListener, startAmbient } from './audio.js';
import { createBots } from './bots.js';
import { createKillCam } from './killcam.js';
import { applyLook } from './graphics.js';
import { createAnimations } from './animations.js';

const CSS = `
.sg{font-family:system-ui,sans-serif;color:#fff;user-select:none;-webkit-user-select:none;background:#9fdcff}
.sg canvas.main{width:100%;height:100%;display:block}
.sg .ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(20,30,45,.74);text-align:center;padding:16px;z-index:100}
.sg .ov h2{margin:0;font-size:clamp(24px,4.5vw,44px)}
.sg .ov p{margin:0;font-size:clamp(12px,1.6vw,16px);opacity:.92;max-width:680px;line-height:1.45}
.sg button.b{font:inherit;font-weight:700;padding:12px 20px;border-radius:10px;border:0;background:#ffd166;color:#222;cursor:pointer;min-height:44px}
.sg button.b.alt{background:#9ad1ff}
.sg .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.sg .info{position:absolute;top:56px;left:50%;transform:translateX(-50%);z-index:21;font-weight:700;font-size:15px;text-shadow:0 2px 0 rgba(0,0,0,.5);pointer-events:none;white-space:nowrap}
.sg .kf{position:absolute;right:24px;top:70px;z-index:21;font-weight:700;text-align:right;text-shadow:0 1px 3px #000;pointer-events:none}
`;
const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class Game {
  constructor(root) {
    this.root = root; root.classList.add('sg');
    if (!document.getElementById('sg-css')) { const s = document.createElement('style'); s.id = 'sg-css'; s.textContent = CSS; document.head.appendChild(s); }
    this.canvas = document.createElement('canvas'); this.canvas.className = 'main'; root.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.scene = new THREE.Scene();
    this.map = buildMap(THREE); this.scene.add(this.map.group);
    this.scene.background = new THREE.Color(this.map.sky.background);
    this.scene.fog = new THREE.Fog(this.map.sky.fog.color, this.map.sky.fog.near, this.map.sky.fog.far);
    this.camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 400); this.scene.add(this.camera);
    try { this.look = /[?&]look=off/.test(location.search) ? null : applyLook(THREE, this.renderer, this.scene, this.map); } catch (err) { console.error('look', err); this.look = null; }

    // physics world: map blocking boxes + roof slabs + ramps (from the map's floor/ramp data)
    const m = this.map; const phys = [...m.colliders];
    for (const f of m.floors) if (f.y > 0) phys.push({ min: { x: f.minX, y: f.y - 3, z: f.minZ }, max: { x: f.maxX, y: f.y, z: f.maxZ } });
    for (const r of m.ramps) phys.push({ type: 'ramp', axis: r.axis, direction: r.y1 > r.y0 ? 1 : -1, min: { x: r.minX, y: Math.min(r.y0, r.y1), z: r.minZ }, max: { x: r.maxX, y: Math.max(r.y0, r.y1), z: r.maxZ } });
    this.phys = phys;
    this.world = [...phys, { min: { x: -40, y: -2, z: -40 }, max: { x: 40, y: 0, z: 40 } }]; // ground also stops bullets

    const spawnT = m.spawnPoints.filter((s) => s.team === 'T')[0];
    this.spawnT = spawnT.position.clone();
    this.ctrl = createController(this.phys, { position: { x: this.spawnT.x, y: this.spawnT.y, z: this.spawnT.z }, yaw: 0 });
    this.ctrl.connect(this.canvas);
    this.vm = createViewmodels(THREE); this.camera.add(this.vm.group);
    this.hud = createHUD(root); this.hud.root.style.display = 'none';
    this.ws = createWeaponSystem(THREE, this.vm, this.hud);
    this.ws.onEvent = (n, d) => this.onWeaponEvent(n, d);
    this.player = createPlayerState();
    this.bots = createBots(THREE, this.scene, m, { raycast, colliders: this.world });
    this.anim = createAnimations(THREE, { scene: this.scene, camera: this.camera, vm: this.vm, root: root, renderer: this.renderer, bots: this.bots }); this.anim.settings.slowmo = false; this.anim.settings.tracers = false;
    this.info = document.createElement('div'); this.info.className = 'info'; root.appendChild(this.info);
    this.kf = document.createElement('div'); this.kf.className = 'kf'; root.appendChild(this.kf);
    this.perf = document.createElement('div'); this.perf.style.cssText = 'position:absolute;right:10px;bottom:8px;z-index:200;font:700 12px/1 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.45);padding:5px 8px;border-radius:8px;pointer-events:none'; this.perf.textContent = '-- FPS · -- ms'; root.appendChild(this.perf); this.pf = { n: 0, t: 0, worst: 0 };
    this.ov = document.createElement('div'); this.ov.className = 'ov'; root.appendChild(this.ov);
    this.kc = createKillCam(THREE, { scene: this.scene, camera: this.camera, renderer: this.renderer, root, raycast, colliders: this.world, getGround: (x, z) => m.getHeight(x, z), hideHud: (on) => { this.kcHide = on; this.hud.root.style.display = on || this.state === 'menu' ? 'none' : ''; this.info.style.visibility = this.kf.style.visibility = on ? 'hidden' : ''; } });
    this.fx = []; this.state = 'menu'; this.mode = 'bomb'; this.locked = false; this.wasLocked = false;
    this.ctrl.setEnabled(false);
    this.bomb = { planted: false, pos: new THREE.Vector3(), t: 0, site: '', defuseT: 0, beepT: 0 };
    this.bombMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.35), new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0xff0000, emissiveIntensity: 0.7 }));
    this.bombMesh.visible = false; this.scene.add(this.bombMesh);
    this.eDown = false; this.plantT = 0; this.stepT = 0; this.score = 0; this.kills = 0; this.heads = 0;
    initAudio({ volume: 0.7, ambient: true });
    this.bindEvents(); this.resize();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(root);
    this.last = performance.now(); this.running = true; this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
    this.showMenu();
  }
  resize() {
    const w = this.root.clientWidth || 640, h = this.root.clientHeight || 360;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  bindEvents() {
    const d = document, c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('mousedown', (e) => {
      if (this.state !== 'play') return;
      if (!this.ctrl.state.pointerLocked) this.ctrl.requestPointerLock();
      if (e.button === 0) this.ws.setTrigger(true);
      if (e.button === 2) { this.aimDownAt = performance.now(); if (this.ws.aiming) { this.ws.setAim(false); this.aimSkipUp = true; } else this.ws.setAim(true); }
      e.preventDefault();
    });
    d.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.ws.setTrigger(false);
      if (e.button === 2) { if (this.aimSkipUp) this.aimSkipUp = false; else if (performance.now() - this.aimDownAt > 350) this.ws.setAim(false); } // tap = toggle, hold = classic
    });
    d.addEventListener('keydown', (e) => { if (this.state === 'play' && e.code === 'KeyQ' && !e.repeat) this.ws.setAim(!this.ws.aiming); });
    d.addEventListener('wheel', (e) => { if (this.state === 'play') this.ws.cycle(e.deltaY > 0 ? 1 : -1); }, { passive: true });
    d.addEventListener('pointerlockchange', () => {
      const on = d.pointerLockElement === c;
      if (on) { this.wasLocked = true; } else if (this.wasLocked) { this.wasLocked = false; if (this.state === 'play') this.pause(); }
    });
    d.addEventListener('keydown', (e) => {
      if (this.state !== 'play') return;
      if (e.code === 'Escape') { this.pause(); return; }
      if (e.code === 'Digit1') this.ws.select(0); else if (e.code === 'Digit2') this.ws.select(1); else if (e.code === 'Digit3') this.ws.select(2);
      else if (e.code === 'KeyR') this.ws.reload(); else if (e.code === 'KeyE') this.eDown = true;
    });
    d.addEventListener('keyup', (e) => { if (e.code === 'KeyE') this.eDown = false; });
  }
  onWeaponEvent(n, d) {
    const map = { pistol: 'shot_pistol', machinegun: 'shot_mg', sniper: 'shot_sniper' };
    if (n === 'shot') play(map[d.weapon]); else if (n === 'empty') { play('empty'); this.anim.onEmpty(); } else if (n === 'reload') { play('reload'); this.anim.onReload(); } else if (n === 'switch') { play('ui_click'); this.anim.onSwitch(); }
  }
  overlay(html, btns) {
    this.ov.style.display = 'flex'; this.ov.innerHTML = html;
    const row = document.createElement('div'); row.className = 'row';
    for (const [t, fn, alt] of btns) { const b = document.createElement('button'); b.className = 'b' + (alt ? ' alt' : ''); b.textContent = t; b.onclick = fn; row.appendChild(b); }
    this.ov.appendChild(row);
  }
  showMenu() {
    this.state = 'menu'; this.hud.root.style.display = 'none'; this.info.textContent = ''; this.kf.textContent = '';
    this.ctrl.setEnabled(false); this.ctrl.exitPointerLock();
    this.overlay(`<h2>Sniper Chill</h2><p>Tú contra 5 bots en una isla de azoteas. Planta la bomba en A (suelo) o B (azotea) manteniendo E y aguanta, o elimínalos a todos.</p>
<p><b>WASD</b> moverte · <b>ratón</b> apuntar · <b>clic</b> disparar · <b>clic derecho</b> apuntar/mirilla · <b>1 2 3</b> armas · <b>R</b> recargar · <b>E</b> plantar · <b>espacio</b> saltar · <b>Shift</b> agacharte</p>
<p>Sniper: 1 tiro y muerto. Pistola y ametralladora: barra de vida, pero un tiro a la cabeza mata. Pulsa F para pantalla completa.</p>`,
      [['Bomba contra bots', () => this.start('bomb')], ['Reto diario (60 s, ranking)', () => this.start('daily'), true]]);
  }
  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause'; this.ctrl.setEnabled(false); this.ws.setTrigger(false); this.ws.setAim(false); this.eDown = false; this.ctrl.exitPointerLock();
    this.overlay('<h2>Pausa</h2><p>Haz clic para seguir (capturará el ratón).</p>', [['Continuar', () => this.resume()], ['Salir al menú', () => this.showMenu(), true]]);
  }
  resume() { this.ov.style.display = 'none'; this.state = 'play'; this.ctrl.setEnabled(true); this.ctrl.requestPointerLock(); }
  start(mode) {
    this.mode = mode; this.kc.clear(); this.bots.clear(); this.player.reset(); this.ws.refill(); this.ws.select(0);
    this.ctrl.teleport({ x: this.spawnT.x, y: this.spawnT.y, z: this.spawnT.z }, { yaw: 0, pitch: 0 });
    this.bomb.planted = false; this.bombMesh.visible = false; this.plantT = 0; this.eDown = false;
    this.score = 0; this.kills = 0; this.heads = 0; this.roundT = mode === 'bomb' ? 150 : 60; this.spawnTimer = 0.5; this.over = false; this.kf.textContent = '';
    this.rng = mulberry(Number(new Date().toISOString().slice(0, 10).replace(/-/g, '')));
    if (mode === 'bomb') {
      const ct = this.map.spawnPoints.filter((s) => s.team === 'CT');
      ct.slice(0, 5).forEach((s, i) => this.bots.spawn(s.position, { defuser: i === 0, pro: true, difficulty: i < 2 ? 'hard' : 'medium' }));
    }
    this.hud.setHealth(100); this.hud.root.style.display = ''; this.ov.style.display = 'none'; this.state = 'play';
    this.ctrl.setEnabled(true); this.ctrl.requestPointerLock(); play('ui_click'); startAmbient();
  }
  end(win, msg) {
    if (this.over) return; if (this.kc.active) { this.pendEnd = [win, msg]; return; } this.over = true; this.state = 'over'; this.ctrl.setEnabled(false); this.ws.setTrigger(false); this.ws.setAim(false); this.ctrl.exitPointerLock();
    let extra = '';
    if (this.mode === 'daily') {
      const key = 'sniperchill-daily-' + new Date().toISOString().slice(0, 10); let top = []; try { top = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
      top.push(this.score); top.sort((a, b) => b - a); top = top.slice(0, 5); try { localStorage.setItem(key, JSON.stringify(top)); } catch (e) {}
      extra = `<p>Puntos: <b>${this.score}</b> · Bajas: ${this.kills} · Headshots: ${this.heads}</p><p>Tu top de hoy (solo en este dispositivo): ${top.join(' · ')}</p>`;
    }
    this.overlay(`<h2>${win ? 'Ganas' : 'Pierdes'}</h2><p>${msg}</p>${extra}`, [['Otra vez', () => this.start(this.mode)], ['Menú', () => this.showMenu(), true]]);
  }
  tracer(a, b, color = 0xfff2a0, life = 0.07) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]); const m = new THREE.LineBasicMaterial({ color, transparent: true });
    const l = new THREE.Line(g, m); this.scene.add(l); this.fx.push({ l, t: life, life });
  }
  fireShots(shots) {
    const st = this.ctrl.state, o = { x: st.eye.x, y: st.eye.y, z: st.eye.z }, muzzle = new THREE.Vector3();
    this.vm.muzzleWorldPosition(muzzle);
    if (shots.length && this.bots.noise) this.bots.noise(o.x, o.z, 55);
    for (const s of shots) {
      const yaw = st.yaw + s.dir.x, pit = st.pitch + s.dir.y, cp = Math.cos(pit);
      const dir = { x: -Math.sin(yaw) * cp, y: Math.sin(pit), z: -Math.cos(yaw) * cp };
      const hit = raycast(o, dir, { colliders: this.world, targets: this.bots.list, maxDistance: s.range });
      const end = hit ? hit.point : { x: o.x + dir.x * s.range, y: o.y + dir.y * s.range, z: o.z + dir.z * s.range };
      this.anim.onShot({ weapon: s.weapon, end, hit });
      let kh = hit ? (hit.kind === 'target' ? null : { kind: 'world', normal: hit.normal }) : null;
      if (hit && hit.kind === 'target') {
        const b = hit.target, zone = hit.zone === 'legs' ? 'limb' : hit.zone;
        const r = applyDamage(b.health, s.weapon, zone);
        kh = { kind: 'target', bot: b, zone, headshot: r.headshot, killed: r.killed };
        this.bots.damage(b, r.hp, r.headshot); this.anim.onBotHit(b, { dir, point: hit.point, headshot: r.headshot, killed: r.killed, damage: r.damage });
        this.hud.hitMarker(r.killed, r.headshot);
        play(r.killed ? 'kill' : r.headshot ? 'headshot' : 'hit');
        if (r.killed) {
          this.kills++; this.score += 100 + (r.headshot ? 50 : 0); if (r.headshot) this.heads++;
          this.kf.textContent = r.headshot ? 'HEADSHOT +150' : 'Baja +100'; this.kfT = 1.5;
        }
      }
      this.kc.shoot({ muzzle, end, weapon: s.weapon, hit: kh });
    }
  }
  update(dt) {
    const c = this.ctrl, st = c.state;
    c.update(dt);
    const k = this.ws.consumeLook(); if (k.pitch || k.yaw) c.look(-k.yaw / 0.0022, -k.pitch / 0.0022);
    c.applyToCamera(this.camera);
    this.camera.fov = this.ws.fov(75); this.camera.updateProjectionMatrix();
    const moving = Math.hypot(st.velocity.x, st.velocity.z) > 0.5;
    const shots = this.ws.update(dt, { moving, sprinting: st.speed > 5.5, grounded: st.grounded });
    if (shots.length) this.fireShots(shots);
    const fwd = c.getDirection(); setListener(st.eye, fwd);
    if (moving && st.grounded) { this.stepT -= dt; if (this.stepT <= 0) { play('footstep'); this.stepT = st.speed > 5.5 ? 0.3 : 0.45; } }
    this.hud.setHealth(this.player.hp);
    if (this.kfT > 0) { this.kfT -= dt; if (this.kfT <= 0) this.kf.textContent = ''; }

    // bomb planting
    const bs = this.map.bombsites; let site = null;
    for (const key of ['A', 'B']) { const s = bs[key], d = Math.hypot(st.position.x - s.center.x, st.position.z - s.center.z); if (d < s.radius && Math.abs(st.position.y - s.center.y) < 2) site = key; }
    let hint = '';
    if (this.mode === 'bomb' && !this.bomb.planted) {
      if (site && this.eDown && st.grounded) { this.plantT += dt; hint = `Plantando ${site}... ${Math.min(100, Math.round(this.plantT / 3.2 * 100))}%`; if (this.plantT >= 3.2) this.plant(site); }
      else { this.plantT = 0; hint = site ? `Mantén E para plantar en ${site}` : 'Ve al sitio A o B'; }
    }
    // bots
    const self = this;
    const events = this.bots.update(dt, {
      playerEye: st.eye, playerAlive: this.player.alive,
      bomb: { planted: this.bomb.planted, pos: this.bomb.pos, site: this.bomb.site, defuse(d) { self.bomb.defuseT += d; return self.bomb.defuseT >= 5; } },
    });
    for (const e of events) {
      if (e.type === 'shot') {
        play('bot_shot', e.from); this.anim.onBotShot(e.hit ? e : { ...e, to: e.to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5), (Math.random() - 0.5) * 3)) });
        if (e.hit && this.player.alive) { this.player.damage(e.damage); this.hud.damageFlash(); play('hurt'); if (!this.player.alive) { this.hud.setHealth(0); this.end(false, 'Te han eliminado.'); } }
      } else if (e.type === 'defused') { play('bomb_defuse'); this.end(false, 'Desactivaron la bomba.'); }
    }
    this.anim.update(dt, { moving, sprinting: false, grounded: st.grounded, playerEye: st.eye, feetY: st.position.y, bots: this.bots.list });
    if (this.over) return;
    // timers / rules
    if (this.mode === 'bomb') {
      if (this.bomb.planted) {
        this.bomb.t -= dt; this.bomb.beepT -= dt;
        if (this.bomb.beepT <= 0) { play('bomb_beep', this.bomb.pos); this.bomb.beepT = this.bomb.t < 10 ? 0.35 : 1; }
        hint = `BOMBA ${this.bomb.site} · ${fmt(Math.max(0, this.bomb.t))}`;
        if (this.bomb.t <= 0) {
          play('bomb_explode'); const d = Math.hypot(st.position.x - this.bomb.pos.x, st.position.z - this.bomb.pos.z);
          if (d < 14) { this.hud.damageFlash(); this.end(false, 'La bomba te alcanzó. Aléjate más antes de que explote.'); } else this.end(true, 'La bomba explotó. ¡Ganas la ronda!');
        }
      } else { this.roundT -= dt; if (this.roundT <= 0) { this.end(false, 'Se acabó el tiempo sin plantar la bomba.'); return; } }
      if (this.bots.aliveCount() === 0) { this.end(true, 'Eliminaste a todos los bots.'); return; }
      this.info.textContent = `${hint}${this.bomb.planted ? '' : ' · ' + fmt(this.roundT)} · Bots ${this.bots.aliveCount()}`;
      this.hud.setBombText('');
    } else {
      this.roundT -= dt; this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.bots.aliveCount() < 4) {
        this.spawnTimer = 1.2;
        for (let i = 0; i < 12; i++) { const p = this.map.navGrid.randomWalkable(); if (Math.hypot(p.x - st.position.x, p.z - st.position.z) > 18) { this.bots.spawn(p); break; } }
      }
      this.info.textContent = `${fmt(Math.max(0, this.roundT))} · Puntos ${this.score} · Bajas ${this.kills}`;
      if (this.roundT <= 0) this.end(true, 'Tiempo. Buen reto.');
    }
  }
  plant(site) {
    const s = this.map.bombsites[site], st = this.ctrl.state;
    this.bomb.planted = true; this.bomb.site = site; this.bomb.t = 40; this.bomb.defuseT = 0; this.bomb.beepT = 0;
    this.bomb.pos.set(st.position.x, st.position.y, st.position.z); this.bombMesh.position.set(st.position.x, st.position.y + 0.13, st.position.z); this.bombMesh.visible = true; play('bomb_plant'); this.anim.onBombPlant(this.bomb.pos);
  }
  loop(now) {
    if (!this.running) return; requestAnimationFrame(this.loop);
    { const fr = now - this.last; const p = this.pf; p.n++; p.t += fr; if (fr > p.worst) p.worst = fr; if (p.t >= 500) { this.perf.textContent = Math.round(p.n * 1000 / p.t) + ' FPS · ' + Math.round(p.t / p.n) + ' ms (max ' + Math.round(p.worst) + ')'; p.n = 0; p.t = 0; p.worst = 0; } }
    const real = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const dt = real * this.kc.update(real);
    if (this.pendEnd && !this.kc.active) { const p = this.pendEnd; this.pendEnd = null; this.end(p[0], p[1]); }
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t -= dt; f.l.material.opacity = Math.max(0, f.t / f.life); if (f.t <= 0) { this.scene.remove(f.l); f.l.geometry.dispose(); f.l.material.dispose(); this.fx.splice(i, 1); } }
    if (this.state === 'play') this.update(dt);
    else if (this.state !== 'pause') { this.bots.update(dt * (this.state === 'over' ? 1 : 0), { playerEye: this.ctrl.state.eye, playerAlive: false, bomb: null }); this.ctrl.applyToCamera(this.camera); this.anim.update(dt, { bots: this.bots.list }); }
    this.kc.applyCamera();
    if (this.look) this.look.render(this.camera); else this.renderer.render(this.scene, this.camera);
    this.kc.afterRender();
  }
  destroy() { this.running = false; this.ro && this.ro.disconnect(); this.ctrl.dispose(); this.renderer.dispose(); }
}
