// stats.js - per-device player stats + shareable result card. No account, no server, no personal data (name is the local nickname only).
const KEY = 'sc_stats', URL_ = 'https://instinct-juan-train.github.io/sniper-chill/';
const blank = () => ({ rounds: 0, roundsWon: 0, matches: 0, matchesWon: 0, kills: 0, heads: 0, bestRoundKills: 0, bestScore: 0, diff: {}, last: 0 });
export function getStats() { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return blank(); } }
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
export function recordRound(g, win) {
  const s = getStats(); s.rounds++; if (win) s.roundsWon++; s.kills += g.kills || 0; s.heads += g.heads || 0;
  s.bestRoundKills = Math.max(s.bestRoundKills, g.kills || 0); s.bestScore = Math.max(s.bestScore, g.score || 0);
  s.diff[g.diff] = (s.diff[g.diff] || 0) + 1; s.last = Date.now();
  const m = g.match; if (m && (m.p >= 3 || m.b >= 3 || m.p + m.b >= 5)) { s.matches++; if (m.p > m.b) s.matchesWon++; }
  save(s); return s;
}
export function favDiff(s) { let b = '', n = 0; for (const k in s.diff) if (s.diff[k] > n) { b = k; n = s.diff[k]; } return b; }
export function rank(s) { const w = s.matchesWon * 3 + s.roundsWon + s.kills / 10; return w >= 120 ? 'Legend' : w >= 60 ? 'Sharpshooter' : w >= 25 ? 'Regular' : w >= 8 ? 'Rookie+' : 'Rookie'; }
export function shareText(s, name) { return `${name} on ChillOps: ${s.kills} kills, ${s.matchesWon} match wins, ${rank(s)}. Think you can beat that? ${URL_}`; }
export function shareCard(s, name) {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, 630); sky.addColorStop(0, '#7fd3ff'); sky.addColorStop(1, '#ffe9a8'); x.fillStyle = sky; x.fillRect(0, 0, 1200, 630);
  x.fillStyle = 'rgba(255,255,255,.55)'; for (const [a, b, r] of [[200, 110, 60], [260, 120, 48], [900, 90, 56], [960, 100, 44]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
  x.fillStyle = '#333a55'; x.fillRect(0, 470, 1200, 160); x.fillStyle = '#6fd09a'; x.fillRect(0, 462, 1200, 14);
  x.textAlign = 'left'; x.fillStyle = '#fff'; x.strokeStyle = '#333a55'; x.lineWidth = 10; x.font = '800 120px Teko, Impact, sans-serif'; x.strokeText('CHILLOPS', 60, 150); x.fillText('CHILLOPS', 60, 150);
  x.font = '600 54px Teko, Impact, sans-serif'; x.fillStyle = '#333a55'; x.fillText((name + '  -  ' + rank(s)).toUpperCase(), 64, 220);
  const box = (lx, ly, big, small) => { x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(lx, ly, 250, 150); x.fillStyle = '#333a55'; x.font = '800 84px Teko, Impact, sans-serif'; x.fillText(String(big), lx + 20, ly + 88); x.font = '600 30px Teko, Impact, sans-serif'; x.fillText(small, lx + 22, ly + 130); };
  box(60, 260, s.kills, 'KILLS'); box(340, 260, s.matchesWon, 'MATCH WINS'); box(620, 260, s.heads, 'HEADSHOTS'); box(900, 260, s.bestRoundKills, 'BEST ROUND');
  x.fillStyle = '#fff'; x.font = '600 40px Teko, Impact, sans-serif'; x.fillText('Chill 1v1 / 2v2 sniper game. Free in your browser.', 60, 540); x.fillText(URL_.replace('https://', ''), 60, 590);
  return c.toDataURL('image/png');
}
