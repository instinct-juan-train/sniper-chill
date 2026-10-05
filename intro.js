// intro.js - ChillOps logo reveal + animated menu backdrop. No deps.
const COLORS = ['#ffd166', '#7dffb0', '#9ad1ff', '#ff9ac8', '#ffb35c', '#c8a8ff', '#ffffff'];
const CSS = `
@keyframes ch-pop{0%{transform:translateY(60px) scale(.3) rotate(-14deg);opacity:0}60%{transform:translateY(-10px) scale(1.15) rotate(4deg);opacity:1}100%{transform:none;opacity:1}}
@keyframes ch-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes ch-fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes ch-bg{0%{background-position:0% 50%}100%{background-position:200% 50%}}
.chi{position:absolute;inset:0;z-index:500;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(120deg,#8fd3ff,#c9b6ff,#ffc2dd,#ffe3a3,#8fd3ff);background-size:200% 200%;animation:ch-bg 4s linear infinite;cursor:pointer;transition:opacity .5s;font-family:Fredoka,system-ui,sans-serif;overflow:hidden}
.chi.out{opacity:0;pointer-events:none}
.chi canvas,.chbg canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.chl{position:relative;display:flex;gap:2px;font-weight:700;font-size:clamp(54px,13vw,150px);line-height:1;color:#fff;text-shadow:0 5px 0 #2a3b55,0 9px 0 rgba(0,0,0,.18);-webkit-text-stroke:3px #2a3b55;paint-order:stroke fill}
.chl span{display:inline-block;opacity:0;animation:ch-pop .7s cubic-bezier(.2,1.4,.4,1) forwards}
.chl span:nth-child(n+6){color:#ffd166}
.cht{position:relative;margin-top:14px;font-weight:600;font-size:clamp(14px,2.4vw,24px);letter-spacing:.35em;color:#2a3b55;opacity:0;animation:ch-fade .6s 1.5s forwards}
.chs{position:absolute;bottom:18px;font-size:13px;color:#2a3b55;opacity:.6;font-weight:500}
.chbg{position:absolute;inset:0;overflow:hidden;z-index:0;pointer-events:none;background:linear-gradient(160deg,#3a5f9e,#6a4fa3 45%,#d9709b 100%);background-size:100% 100%}
.sg .ov .row{position:relative;z-index:1}
.chm{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:12px}
.chm .chl{font-size:clamp(44px,9vw,104px);animation:ch-bob 3.2s ease-in-out infinite}
.chm .chl span{opacity:1;animation:none}
`;
function ensureCSS() { if (document.getElementById('ch-css')) return; const s = document.createElement('style'); s.id = 'ch-css'; s.textContent = CSS; document.head.appendChild(s); }
export function logoHTML() { return 'ChillOps'.split('').map((c, i) => `<span style="animation-delay:${0.15 + i * 0.09}s">${c}</span>`).join(''); }

// confetti: pastel rectangles, circles and kite diamonds
export function startConfetti(cv, { burst = 0, rain = 40, speed = 1 } = {}) {
  const ctx = cv.getContext('2d'); let W = 0, H = 0, run = true, parts = [];
  const size = () => { const r = cv.getBoundingClientRect(); const d = Math.min(2, devicePixelRatio || 1); W = cv.width = Math.max(1, r.width * d | 0); H = cv.height = Math.max(1, r.height * d | 0); };
  size(); addEventListener('resize', size);
  const mk = (x, y, vx, vy) => ({ x, y, vx, vy, r: 5 + Math.random() * 9, a: Math.random() * 6.28, va: (Math.random() - .5) * .2, c: COLORS[Math.random() * COLORS.length | 0], k: Math.random() * 3 | 0, ph: Math.random() * 6 });
  for (let i = 0; i < rain; i++) parts.push(mk(Math.random() * W, Math.random() * H, 0, (0.6 + Math.random() * 1.2) * speed));
  for (let i = 0; i < burst; i++) { const a = Math.random() * 6.28, v = 6 + Math.random() * 14; parts.push(mk(W / 2, H * .45, Math.cos(a) * v, Math.sin(a) * v - 6)); }
  const draw = (p) => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; const r = p.r * (devicePixelRatio > 1 ? 1.5 : 1);
    if (p.k === 0) ctx.fillRect(-r, -r / 2, r * 2, r); else if (p.k === 1) { ctx.beginPath(); ctx.arc(0, 0, r / 1.6, 0, 6.28); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * .8, 0); ctx.lineTo(0, r * 1.6); ctx.lineTo(-r * .8, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-1, r * 1.6, 2, r * 1.2); }
    ctx.restore(); };
  let last = performance.now();
  const loop = (t) => { if (!run) return; requestAnimationFrame(loop); const dt = Math.min(2.5, (t - last) / 16.7); last = t; ctx.clearRect(0, 0, W, H);
    for (const p of parts) { p.vx *= .985; p.vy += .12 * dt * (p.vy > 2 * speed ? 0 : 1); if (p.vy > 2.2 * speed) p.vy = 2.2 * speed; p.x += (p.vx + Math.sin(t / 500 + p.ph) * .6) * dt; p.y += p.vy * dt; p.a += p.va * dt;
      if (p.y > H + 30) { p.y = -20; p.x = Math.random() * W; p.vx = 0; } if (p.x < -30) p.x = W + 20; if (p.x > W + 30) p.x = -20; draw(p); } };
  requestAnimationFrame(loop);
  return () => { run = false; removeEventListener('resize', size); };
}

export function playIntro(root, onDone) {
  ensureCSS();
  const el = document.createElement('div'); el.className = 'chi';
  el.innerHTML = `<canvas></canvas><div class="chl">${logoHTML()}</div><div class="cht">CHILL · AIM · ENJOY</div><div class="chs">click to skip</div>`;
  root.appendChild(el);
  const stop = startConfetti(el.querySelector('canvas'), { burst: 140, rain: 30 });
  let done = false;
  const finish = () => { if (done) return; done = true; el.classList.add('out'); removeEventListener('keydown', finish, true); setTimeout(() => { stop(); el.remove(); }, 550); onDone && onDone(); };
  el.addEventListener('click', finish); addEventListener('keydown', finish, true);
  setTimeout(finish, 3200);
  return finish;
}

// animated menu backdrop; returns {html, mount(ovEl)} helpers
export function menuBackdrop(ov) {
  ensureCSS();
  const bg = document.createElement('div'); bg.className = 'chbg'; bg.innerHTML = '<canvas></canvas>'; ov.prepend(bg);
  const stop = startConfetti(bg.querySelector('canvas'), { rain: 38, speed: .7 });
  return () => { stop(); bg.remove(); };
}
