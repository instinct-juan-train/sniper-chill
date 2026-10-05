// ads.js - sponsor slots (billboards on walls). Free monetization hook: every slot is a named plane with a swappable image.
// Config: ads.json next to index.html: { "slots": { "billboard-plaza-1": { "image": "ads/brand.png", "href": "https://..." } } }
// Runtime: window.ChillAds.setSlot(name, imageUrl). With no config a slot shows a neutral "YOUR BRAND HERE" placeholder.
// Visual only: no colliders, MeshBasicMaterial (no shading, no shadows, no z-fighting: stands 4 cm off the wall).
const SLOTS = [
  // name, x, y, z, width, height, facing (rotation.y; 0 = faces +z, PI = -z, PI/2 = +x, -PI/2 = -x)
  ['billboard-plaza-1', 2.6, 3.0, 4.06, 3.4, 1.5, 0],
  ['billboard-plaza-2', -23, 3.3, 12.06, 3.4, 1.5, 0],
  ['billboard-court-1', 0, 3.0, -8.06, 3.4, 1.5, Math.PI],
];
export function addAds(THREE, scene, opts = {}) {
  const group = new THREE.Group(); group.name = 'ads'; const slots = new Map();
  const placeholder = (label) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 224; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 512, 224); g.addColorStop(0, '#ffe9a8'); g.addColorStop(1, '#ffb3c1'); x.fillStyle = g; x.fillRect(0, 0, 512, 224);
    x.strokeStyle = '#333a55'; x.lineWidth = 10; x.strokeRect(5, 5, 502, 214); x.fillStyle = '#333a55'; x.textAlign = 'center';
    x.font = '800 64px Teko, Impact, sans-serif'; x.fillText('YOUR BRAND HERE', 256, 112); x.font = '600 30px Teko, Impact, sans-serif'; x.fillText(label, 256, 160);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  for (const [name, x, y, z, w, h, ry] of SLOTS) {
    const mat = new THREE.MeshBasicMaterial({ map: placeholder('sponsor slot'), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x333a55, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat), frame = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.2, h + 0.2), frameMat);
    mesh.position.set(0, 0, 0.02); frame.position.set(0, 0, 0.005);
    const g = new THREE.Group(); g.add(frame, mesh); g.position.set(x, y, z); g.rotation.y = ry; g.userData.slot = name; group.add(g); slots.set(name, { mesh, mat });
  }
  scene.add(group);
  const loader = new THREE.TextureLoader();
  const api = {
    group, names: () => [...slots.keys()],
    setSlot(name, url) { const s = slots.get(name); if (!s) return false; loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; s.mat.map = t; s.mat.needsUpdate = true; }); return true; },
  };
  window.ChillAds = api;
  fetch('ads.json?' + (Date.now() / 3600000 | 0)).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.slots) for (const k in j.slots) if (j.slots[k].image) api.setSlot(k, j.slots[k].image); }).catch(() => {});
  return api;
}
