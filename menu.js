// menu.js - ChillOps main menu (Black Ops style layout): modes left, section content center, player right.
import { logoHTML, startConfetti } from './intro.js';
const CSS = `
.mn{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;padding:clamp(10px,2.4vh,26px) clamp(14px,3vw,44px);font-family:Fredoka,system-ui,sans-serif;color:#fff;text-align:left;box-sizing:border-box}
.mn-bg{position:absolute;inset:0;z-index:0;background:linear-gradient(160deg,#2f4f86,#5a4a9c 50%,#c4638f);overflow:hidden}.mn-bg canvas{position:absolute;inset:0;width:100%;height:100%}
.mn-logo{font-size:clamp(30px,5.6vh,56px);line-height:1}.mn-logo .chl{font-size:inherit;-webkit-text-stroke:2px #2a3b55;gap:1px;filter:drop-shadow(0 3px 0 rgba(0,0,0,.25))}.mn-logo .chl span{animation:none;opacity:1}
.mn-body{flex:1;display:grid;grid-template-columns:minmax(210px,260px) 1fr minmax(220px,320px);gap:clamp(12px,2.4vw,34px);margin-top:clamp(10px,2.6vh,28px);min-height:0}
.mn-left{display:flex;flex-direction:column;gap:8px}
.mn-h{font-size:12px;font-weight:600;letter-spacing:.2em;opacity:.7;margin:10px 0 2px}.mn-h:first-child{margin-top:0}
.mn-i{font:inherit;font-weight:600;font-size:18px;text-align:left;padding:12px 16px;border-radius:14px;border:2px solid rgba(255,255,255,.25);background:rgba(20,28,50,.45);color:#fff;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;transition:transform .12s,background .12s}
.mn-i small,.mn-i em{font-size:11px;font-style:normal;font-weight:500;opacity:.8;letter-spacing:.05em}
.mn-i:hover:not(.lock){transform:translateX(6px);background:rgba(255,255,255,.18)}
.mn-i.play{background:linear-gradient(#ffd166,#ffb43a);color:#2a2a2a;border-color:#fff;font-size:22px;padding:15px 16px;box-shadow:0 5px 0 rgba(0,0,0,.25)}
.mn-i.sel{border-color:#ffd166;background:rgba(255,209,102,.22)}
.mn-i.lock{opacity:.45;cursor:not-allowed}
.mn-mid{min-width:0;overflow:auto;padding-right:6px}
.mn-mid h3{margin:0 0 12px;font-size:24px}
.mn-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
.mn-card{background:rgba(20,28,50,.55);border:2px solid rgba(255,255,255,.3);border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:6px;animation:ch-fade .35s both}
.mn-card svg{width:54px;height:54px;stroke:#ffd166;fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.mn-card b{font-size:18px}.mn-card .k{align-self:flex-start;background:#ffd166;color:#222;border-radius:10px;padding:2px 10px;font-weight:700;font-size:13px}
.mn-card span{font-size:13px;opacity:.85;line-height:1.3}
.mn-keys{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px 18px}
.mn-keys div{display:flex;align-items:center;gap:10px;font-size:15px}
.mn-keys kbd{min-width:34px;text-align:center;background:#fff;color:#222;font:700 13px Fredoka,system-ui;padding:4px 8px;border-radius:8px;box-shadow:0 3px 0 rgba(0,0,0,.3)}
.mn-tag{opacity:.85;font-size:clamp(15px,2.2vh,20px);margin-top:6px;line-height:1.4;max-width:420px}
.mn-right{display:flex;flex-direction:column;align-items:center;min-height:0;background:rgba(20,28,50,.38);border:2px solid rgba(255,255,255,.22);border-radius:22px;padding:12px}
.mn-right canvas{width:100%;flex:1;min-height:0}
.mn-name{font-size:22px;font-weight:700}.mn-lvl{font-size:13px;opacity:.8;letter-spacing:.12em}
.mn-xp{width:80%;height:8px;border-radius:6px;background:rgba(255,255,255,.2);margin-top:6px;overflow:hidden}.mn-xp i{display:block;height:100%;width:12%;background:#7dffb0}
@media(max-width:760px){.mn-body{grid-template-columns:1fr}.mn-right{display:none}}
`;
const ICONS = {
  uav: '<svg viewBox="0 0 54 54"><circle cx="27" cy="27" r="6"/><path d="M14 27a13 13 0 0 1 13-13M8 27A19 19 0 0 1 27 8M40 27a13 13 0 0 1-13 13M46 27a19 19 0 0 1-19 19"/></svg>',
  missile: '<svg viewBox="0 0 54 54"><path d="M27 6c8 8 9 20 5 30H22c-4-10-3-22 5-30z"/><circle cx="27" cy="22" r="3.5"/><path d="M22 36l-7 7M32 36l7 7M27 40v8"/></svg>',
  rc: '<svg viewBox="0 0 54 54"><path d="M8 34h38v-8l-8-4h-14l-6 4H8z"/><circle cx="17" cy="38" r="4.5"/><circle cx="37" cy="38" r="4.5"/><path d="M27 18V8M23 8h8"/></svg>',
  airstrike: '<svg viewBox="0 0 54 54"><path d="M27 6l6 16 15 8-15 4-2 12h-8l-2-12-15-4 15-8z"/><path d="M17 46v4M27 48v4M37 46v4"/></svg>',
  frag: '<svg viewBox="0 0 54 54"><circle cx="27" cy="31" r="14"/><path d="M22 17l5-7 8 3M27 10v-3"/></svg>',
};
export const STREAK_INFO = [
  { id: 'uav', name: 'Radar UAV', at: 3, key: '4', desc: 'Revela a todos los enemigos en el mapa durante 20 s.' },
  { id: 'missile', name: 'Misil teledirigido', at: 5, key: '5', desc: 'Pilota un misil desde el cielo y estrállalo donde quieras.' },
  { id: 'rc', name: 'Coche RC bomba', at: 7, key: '6', desc: 'Conduce un cochecito explosivo contra los bots.' },
  { id: 'airstrike', name: 'Ataque aéreo', at: 9, key: '7', desc: 'Marca un punto y bombardea en línea.' },
];
export function buildMenu(game, THREE, createCharacter, ROSTER) {
  if (!document.getElementById('mn-css')) { const s = document.createElement('style'); s.id = 'mn-css'; s.textContent = CSS; document.head.appendChild(s); }
  const ov = game.ov, bg = document.createElement('div'); bg.className = 'mn-bg'; bg.innerHTML = '<canvas></canvas>'; ov.appendChild(bg);
  const stopConf = startConfetti(bg.querySelector('canvas'), { rain: 14, speed: .6 });
  const name = (() => { try { return localStorage.getItem('sc_name') || 'Jugador'; } catch (e) { return 'Jugador'; } })();
  const el = document.createElement('div'); el.className = 'mn';
  el.innerHTML = `<div class="mn-logo"><div class="chl">${logoHTML()}</div></div>
<div class="mn-body"><nav class="mn-left">
<div class="mn-h">MODOS</div>
<button class="mn-i play" data-a="play">Contra bots <small>MEJOR DE 5</small></button>
<button class="mn-i lock" disabled>1v1 <em>PRÓXIMAMENTE</em></button>
<button class="mn-i lock" disabled>2v2 <em>PRÓXIMAMENTE</em></button>
<div class="mn-h">MÁS</div>
<button class="mn-i" data-p="streaks">Rachas</button>
<button class="mn-i" data-p="help">Ayuda</button>
<button class="mn-i" data-a="settings">Ajustes</button></nav>
<section class="mn-mid"><div class="mn-tag">Chill. Apunta. Disfruta.<br>Elige un modo y a jugar.</div></section>
<aside class="mn-right"><canvas></canvas><div class="mn-name">${name}</div><div class="mn-lvl">NIVEL 1</div><div class="mn-xp"><i></i></div></aside></div>`;
  ov.appendChild(el);
  const mid = el.querySelector('.mn-mid');
  const panels = {
    streaks: () => `<h3>Rachas</h3><div class="mn-cards">${STREAK_INFO.map((s, i) => `<div class="mn-card" style="animation-delay:${i * 70}ms">${ICONS[s.id]}<b>${s.name}</b><div class="k">${s.at} bajas · tecla ${s.key}</div><span>${s.desc}</span></div>`).join('')}</div><p class="mn-tag" style="font-size:14px">Pulsa <b>G</b> para usar la primera disponible. Si mueres, pierdes la racha; si sobrevives la ronda, se conserva.</p>`,
    help: () => `<h3>Controles</h3><div class="mn-keys">${[['WASD', 'Moverte'], ['Ratón', 'Apuntar'], ['Clic', 'Disparar / cuchillo'], ['Clic dcho', 'Mirilla (toggle)'], ['Shift', 'Agacharte'], ['Espacio', 'Saltar'], ['R', 'Recargar'], ['E', 'Recoger arma / plantar'], ['B', 'Tienda'], ['1 2 3', 'Principal / pistola / cuchillo'], ['V H J', 'Frag / humo / flash'], ['G', 'Usar racha'], ['Esc', 'Pausa']].map(([k, d]) => `<div><kbd>${k}</kbd><span>${d}</span></div>`).join('')}</div>`,
  };
  const open = (p) => { mid.innerHTML = panels[p](); el.querySelectorAll('[data-p]').forEach((b) => b.classList.toggle('sel', b.dataset.p === p)); };
  el.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => open(b.dataset.p); });
  el.querySelector('[data-a=play]').onclick = () => game.start('bomb');
  el.querySelector('[data-a=settings]').onclick = () => game.openSettings();
  // animated character (own tiny renderer)
  let run = true, rend = null, cleanup = () => {};
  try {
    const cv = el.querySelector('.mn-right canvas'); rend = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); rend.setClearColor(0, 0);
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    sc.add(new THREE.AmbientLight(0xffffff, 1.1)); const dl = new THREE.DirectionalLight(0xffffff, 1.3); dl.position.set(2, 4, 3); sc.add(dl);
    const ch = createCharacter(THREE, { id: ROSTER[0].id, team: 'CT', weapon: 'pistol' }); sc.add(ch.group); cam.position.set(0, 1.15, 4.2); cam.lookAt(0, 0.95, 0);
    let last = performance.now(), t = 0;
    const loop = (now) => { if (!run) return; requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const w = cv.clientWidth, h = cv.clientHeight; if (w && (cv.width !== w || cv.height !== h)) { rend.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      ch.group.rotation.y = Math.sin(t * 0.7) * 0.6 - 0.2; ch.update(dt, { speed: 0, alive: true, weapon: 'pistol', team: 'CT', distance: 4 }); rend.render(sc, cam); };
    requestAnimationFrame(loop);
  } catch (e) { /* no WebGL: panel stays empty */ }
  return () => { run = false; stopConf(); try { rend && rend.dispose(); } catch (e) {} bg.remove(); el.remove(); };
}
