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

const BO3_CSS = `
@keyframes bo-bar{from{height:0}to{height:12vh}}
@keyframes bo-slam{0%{transform:scale(3.2);opacity:0;filter:blur(14px)}55%{transform:scale(.94);opacity:1;filter:blur(0)}75%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
@keyframes bo-out{to{opacity:0;transform:scale(.7);filter:blur(10px)}}
@keyframes bo-flash{0%{opacity:.95}100%{opacity:0}}
@keyframes bo-shake{0%,100%{transform:translate(0,0)}20%{transform:translate(-9px,5px)}40%{transform:translate(8px,-6px)}60%{transform:translate(-5px,-4px)}80%{transform:translate(4px,6px)}}
@keyframes bo-sweep{from{transform:translateX(-120%) skewX(-20deg)}to{transform:translateX(260%) skewX(-20deg)}}
@keyframes bo-blink{50%{opacity:.25}}
@keyframes bo-grain{0%{background-position:0 0}100%{background-position:120px 80px}}
.boi{position:absolute;inset:0;z-index:500;background:#05070d;overflow:hidden;font-family:'Teko',Fredoka,Impact,system-ui,sans-serif;color:#fff;transition:opacity .5s}
.boi.out{opacity:0;pointer-events:none}
.boi canvas{position:absolute;inset:0;width:100%;height:100%}
.boi .bar{position:absolute;left:0;right:0;background:#000;z-index:5;animation:bo-bar .5s ease-out forwards}.boi .bar.t{top:0}.boi .bar.b{bottom:0}
.boi .vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,.85));z-index:4;pointer-events:none}
.boi .grain{position:absolute;inset:-60px;opacity:.07;z-index:4;pointer-events:none;background-image:repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 3px);animation:bo-grain .4s linear infinite}
.boi .stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3}
.boi .card{position:absolute;font-weight:600;font-size:clamp(70px,17vw,230px);letter-spacing:.06em;line-height:1;opacity:0;text-shadow:3px 0 #ff2d55,-3px 0 #19e3ff,0 8px 40px rgba(0,0,0,.8);animation:bo-slam .38s cubic-bezier(.2,.9,.2,1) forwards,bo-out .18s ease-in forwards}
.boi .logo{position:absolute;display:flex;flex-direction:column;align-items:center;opacity:0;animation:bo-slam .55s .0s cubic-bezier(.2,.9,.2,1) forwards}
.boi .logo b{font-weight:600;font-size:clamp(80px,19vw,260px);letter-spacing:.05em;line-height:.95;background:linear-gradient(180deg,#fff 30%,#ffd166 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(4px 0 0 #ff2d55) drop-shadow(-4px 0 0 #19e3ff) drop-shadow(0 10px 30px rgba(0,0,0,.7))}
.boi .logo i{font-style:normal;font-weight:500;font-size:clamp(14px,2.4vw,30px);letter-spacing:.7em;opacity:.85;margin-top:6px;padding-left:.7em;color:#9ad1ff}
.boi .sweep{position:absolute;top:0;bottom:0;width:18%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);z-index:4;pointer-events:none;animation:bo-sweep .9s ease-in-out forwards}
.boi .fl{position:absolute;inset:0;background:#fff;z-index:6;pointer-events:none;opacity:0}
.boi .fl.on{animation:bo-flash .35s ease-out forwards}
.boi .skip{position:absolute;right:5vw;bottom:15vh;z-index:7;font-size:20px;letter-spacing:.3em;opacity:.8;animation:bo-blink 1.1s infinite}
.boi.shake .stage{animation:bo-shake .28s}
`;
export function playIntro(root, onDone) {
  ensureCSS();
  if (!document.getElementById('bo-css')) { const st = document.createElement('style'); st.id = 'bo-css'; st.textContent = "@import url('https://fonts.googleapis.com/css2?family=Teko:wght@500;600&display=swap');" + BO3_CSS; document.head.appendChild(st); }
  const el = document.createElement('div'); el.className = 'boi';
  el.innerHTML = `<canvas></canvas><div class="stage"></div><div class="fl"></div><div class="vig"></div><div class="grain"></div><div class="bar t"></div><div class="bar b"></div><div class="skip">PRESS ENTER</div>`;
  root.appendChild(el);
  const stage = el.querySelector('.stage'), fl = el.querySelector('.fl'), cv = el.querySelector('canvas'), cx = cv.getContext('2d');
  const snd = (n, v) => { try { window.ChillAudio && window.ChillAudio.play(n, { volume: v }); } catch (e) {} };
  let done = false, raf = 0, boost = 0, W = 0, H = 0;
  const rays = Array.from({ length: 90 }, () => ({ a: Math.random() * Math.PI * 2, s: 0.2 + Math.random() * 0.8, o: Math.random() }));
  const resize = () => { W = cv.width = root.clientWidth || innerWidth; H = cv.height = root.clientHeight || innerHeight; }; resize();
  let t0 = performance.now();
  const draw = (now) => {
    if (done) return; raf = requestAnimationFrame(draw);
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now; boost = Math.max(0, boost - dt * 1.6);
    cx.clearRect(0, 0, W, H); cx.save(); cx.translate(W / 2, H / 2);
    const R = Math.hypot(W, H) / 2;
    for (const r of rays) { r.o += dt * (0.25 + boost * 2.6) * r.s; if (r.o > 1) { r.o = 0; r.a = Math.random() * Math.PI * 2; } const a0 = R * (0.12 + r.o * 0.9), a1 = a0 + R * (0.04 + boost * 0.35) * r.s; cx.strokeStyle = `rgba(${r.s > .6 ? '25,227,255' : '255,45,85'},${(1 - r.o) * (0.12 + boost * 0.7)})`; cx.lineWidth = 1 + r.s * 2; cx.beginPath(); cx.moveTo(Math.cos(r.a) * a0, Math.sin(r.a) * a0); cx.lineTo(Math.cos(r.a) * a1, Math.sin(r.a) * a1); cx.stroke(); }
    cx.restore();
  };
  raf = requestAnimationFrame(draw);
  const hit = (txt, ms) => {
    const c = document.createElement('div'); c.className = 'card'; c.textContent = txt; c.style.animationDelay = '0s,' + (ms - 0.2) + 's'; stage.appendChild(c);
    boost = 1; fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); snd('hit', 0.9);
  };
  const T = [];
  const at = (ms, f) => T.push(setTimeout(f, ms));
  at(500, () => hit('CHILL', 0.55)); at(1050, () => hit('AIM', 0.5)); at(1550, () => hit('ENJOY', 0.5));
  at(2150, () => {
    stage.innerHTML = `<div class="logo"><b>CHILLOPS</b><i>TACTICAL CHILL SHOOTER</i></div>`;
    boost = 1.6; fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    const sw = document.createElement('div'); sw.className = 'sweep'; el.appendChild(sw); snd('uiStart', 1); snd('bombExplosion', 0.45);
  });
  const finish = () => { if (done) return; done = true; T.forEach(clearTimeout); cancelAnimationFrame(raf); el.classList.add('out'); removeEventListener('keydown', finish, true); setTimeout(() => el.remove(), 550); onDone && onDone(); };
  el.addEventListener('click', finish); addEventListener('keydown', finish, true);
  at(6200, finish);
  return finish;
}

// animated menu backdrop; returns {html, mount(ovEl)} helpers
export function menuBackdrop(ov) {
  ensureCSS();
  const bg = document.createElement('div'); bg.className = 'chbg'; bg.innerHTML = '<canvas></canvas>'; ov.prepend(bg);
  const stop = startConfetti(bg.querySelector('canvas'), { rain: 38, speed: .7 });
  return () => { stop(); bg.remove(); };
}
