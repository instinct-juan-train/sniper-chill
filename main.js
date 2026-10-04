import { Game } from './game.js';
const root = document.getElementById('game');
const g = new Game(root);
window.__g = g;
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
function goFS() { const el = document.documentElement; const f = el.requestFullscreen || el.webkitRequestFullscreen; if (f && !fsEl()) { try { const p = f.call(el); p && p.catch && p.catch(() => {}); } catch (e) {} } }
function exitFS() { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
const btn = document.getElementById('fs');
btn.onclick = (e) => { e.stopPropagation(); fsEl() ? exitFS() : goFS(); };
document.addEventListener('fullscreenchange', () => { btn.textContent = fsEl() ? 'Salir de pantalla completa' : 'Pantalla completa'; });
document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.sg button')) goFS(); }, true);
document.addEventListener('keydown', (e) => { if (e.code === 'KeyF' && g.state !== 'play') { fsEl() ? exitFS() : goFS(); } });
