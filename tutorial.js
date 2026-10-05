// tutorial.js - short onboarding for new players. Black Ops style cards, Enter / click = next, Esc = skip.
const STEPS = [
  { h: 'MOVE AND AIM', k: [['WASD', 'Move'], ['Mouse', 'Look'], ['Click', 'Shoot'], ['Right click / Q', 'Scope'], ['Shift', 'Crouch'], ['Space', 'Jump'], ['R', 'Reload']], p: 'Click the game to lock your mouse. Esc gives it back.' },
  { h: 'BUY PHASE', k: [['B', 'Open shop'], ['1-5', 'Pick a category'], ['Numbers', 'Buy an item'], ['Enter', "LET'S GO (close shop)"]], p: 'Each round starts with a short buy phase. Spend your money on a rifle, sniper, armor or grenades before the round goes live.' },
  { h: 'THE BOMB', k: [['E (hold)', 'Plant at site A or B'], ['Goal', 'Plant it and protect it'], ['Win', 'Bomb explodes or all enemies die'], ['Lose', 'Bomb defused or you die']], p: 'You are the attacker. Walk into a bomb site, hold E until the bar fills, then guard the bomb. Stay out of the blast.' },
  { h: 'KILLSTREAKS', k: [['3 kills', 'UAV (key 4)'], ['5 kills', 'Guided missile (key 5)'], ['7 kills', 'RC bomb car (key 6)'], ['9 kills', 'Airstrike (key 7)'], ['10 kills', 'Tactical nuke (key 8)']], p: 'Slots on the right fill as your streak grows. Press the key or G to call one. Dying resets your streak.' },
  { h: 'GRENADES AND KNIFE', k: [['V', 'Frag'], ['H', 'Smoke'], ['J', 'Flash'], ['3', 'Knife'], ['F', 'Inspect knife']], p: 'Ready? Match is best of 5 rounds. Have fun and stay chill.' },
];
export function showTutorial(root, done) {
  if (!document.getElementById('tut-css')) { const s = document.createElement('style'); s.id = 'tut-css'; s.textContent = `
.tut{position:absolute;inset:0;z-index:600;background:radial-gradient(ellipse at 72% 45%,#2b3560 0%,#141a33 45%,#070a14 100%);color:#fff;font-family:Fredoka,system-ui,sans-serif;display:flex;align-items:center}
.tut-in{margin-left:clamp(24px,7vw,110px);width:min(640px,88vw)}
.tut-n{font-size:12px;letter-spacing:.3em;color:#ffb35c}
.tut h2{font-family:Teko,Impact,sans-serif;font-weight:600;font-size:clamp(46px,9vh,86px);letter-spacing:.1em;margin:4px 0 10px;line-height:1}
.tut h2:before{content:'';display:block;width:64px;height:4px;background:#ff8a2a;margin-bottom:10px}
.tut-k{display:grid;grid-template-columns:auto 1fr;gap:8px 22px;margin:10px 0 16px}.tut-k b{font-weight:600;color:#ffd166;letter-spacing:.06em}.tut-k span{opacity:.92}
.tut p{opacity:.75;font-size:15px;line-height:1.5;max-width:520px}
.tut-r{display:flex;gap:10px;margin-top:20px;align-items:center}
.tut-b{font:inherit;font-weight:600;letter-spacing:.14em;text-transform:uppercase;padding:10px 26px;border:0;cursor:pointer;color:#fff;background:linear-gradient(90deg,#ff8a2a,#ff6a1a 80%,rgba(255,106,26,.2));border-left:3px solid #ffd166}
.tut-s{font:inherit;background:none;border:0;color:#9aa6c8;cursor:pointer;letter-spacing:.14em;text-transform:uppercase;font-size:12px}
.tut-d{display:flex;gap:6px;margin-left:auto}.tut-d i{width:22px;height:4px;background:rgba(255,255,255,.2)}.tut-d i.on{background:#ff8a2a}`; document.head.appendChild(s); }
  let i = 0, over = false;
  const el = document.createElement('div'); el.className = 'tut'; root.appendChild(el);
  const end = () => { if (over) return; over = true; removeEventListener('keydown', key, true); el.remove(); done && done(); };
  const render = () => {
    const s = STEPS[i], last = i === STEPS.length - 1;
    el.innerHTML = `<div class="tut-in"><div class="tut-n">HOW TO PLAY · ${i + 1} / ${STEPS.length}</div><h2>${s.h}</h2><div class="tut-k">${s.k.map(([a, b]) => `<b>${a}</b><span>${b}</span>`).join('')}</div><p>${s.p}</p><div class="tut-r"><button class="tut-b">${last ? "LET'S PLAY" : 'NEXT'}</button><button class="tut-s">Skip</button><div class="tut-d">${STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div></div></div>`;
    el.querySelector('.tut-b').onclick = next; el.querySelector('.tut-s').onclick = end;
  };
  const next = () => { if (i >= STEPS.length - 1) end(); else { i++; render(); } };
  const key = (e) => { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); next(); } else if (e.code === 'Escape') { e.stopImmediatePropagation(); end(); } };
  addEventListener('keydown', key, true); render();
}
