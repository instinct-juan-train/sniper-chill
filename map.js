/**
 * map.js - "Sniper Chill" map module (low-poly rooftop island). Self-contained ES module, no deps.
 *
 * import { buildMap } from './map.js';
 * const map = buildMap(THREE);   // THREE passed in, no import needed here
 * scene.add(map.group);
 *
 * RETURNS
 *  group        THREE.Group  - all visuals (island, water, buildings, crates, bombsite markers).
 *                              Every solid mesh has userData.solid = true; use group.children traversal for bullet raycasts.
 *  lights       THREE.Group  - optional sun + hemisphere light (already inside `group`; also exposed to tweak/remove).
 *  colliders    THREE.Box3[] - BLOCKING boxes in world space (walls, crates, pillars, railings), each with min/max Vector3
 *                              (y-ranges are real, so cover on a rooftop sits at its roof height). Test the player
 *                              capsule/AABB (horizontal circle radius ~0.4, height ~1.7) against those whose y-range
 *                              overlaps [feetY+0.5, feetY+1.7].  A box is also tagged box.name for debugging.
 *  getHeight(x,z) -> number  - walkable floor height at x,z (0 ground, 2.5 rooftops, ramps interpolated, -Infinity
 *                              outside the island). Set feetY = getHeight(x,z) when grounded; refuse a horizontal move if
 *                              getHeight(new) - feetY > map.stepHeight (0.7) (this is what makes rooftop edges un-walkable-up
 *                              and lets ramps work). Falling off a rooftop edge is allowed (gravity down to getHeight).
 *  stepHeight   number 0.7
 *  spawnPoints  [{ position:Vector3, yaw:number, team:'T'|'CT' }]  - 5 per team. Player = T[0] by convention; bots use the rest.
 *  bombsites    { A:{center:Vector3, radius:number, box:Box3}, B:{...} } - plant zone = within radius horizontally of center
 *               (and |y - center.y| < 2). A is on the ground (NW); B is on the SE rooftop (y=2.5).
 *  navGrid      { cellSize, cols, rows, originX, originZ, walkable:Uint8Array(cols*rows), height:Float32Array,
 *                 worldToCell(x,z)->[c,r], cellToWorld(c,r)->Vector3 (centre, at floor height),
 *                 isWalkable(c,r)->bool, findPath(fromVec3,toVec3)->Vector3[] (A*, 8-way, no corner cutting, [] if none),
 *                 randomWalkable()->Vector3 }
 *  bounds       { minX,maxX,minZ,maxZ } island rectangle (also enforced by perimeter walls).
 *  sky          { background:number, fog:{color,near,far} } suggested scene.background / scene.fog values.
 *  dispose()    frees geometries/materials.
 *
 * Coordinates: Y up, 1 unit = 1 metre, island is 64x64 centred on origin. T side is south (+z), CT side is north (-z).
 */
export function buildMap(THREE) {
  const group = new THREE.Group();
  group.name = 'SniperChillMap';
  const colliders = [];
  const floors = [];   // {minX,maxX,minZ,maxZ,y}
  const ramps = [];    // {minX,maxX,minZ,maxZ,axis:'x'|'z',from,to,y0,y1}
  const HALF = 32, ROOF = 2.5, STEP = 0.7;
  const geos = [], mats = [];
  const matCache = {};
  const mat = (c, opts = {}) => {
    const k = c + JSON.stringify(opts);
    if (!matCache[k]) { matCache[k] = new THREE.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, opts)); mats.push(matCache[k]); }
    return matCache[k];
  };
  const palette = { sand: 0xf2d9a0, grass: 0x8fd694, wall: 0xf6efe6, wallB: 0xffb3c1, wallC: 0xa8d8ea, roof: 0xe8a87c, crate: 0xc98f5a,
    crate2: 0x7fb2d9, dark: 0x6b6f80, water: 0x4fc3e8, ramp: 0xd9c7a3, siteA: 0xff6b6b, siteB: 0x6bcB77, palm: 0x4caf6a, trunk: 0x9c6b3f };

  function addMesh(geo, material, x, y, z, solid) {
    geos.push(geo);
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.solid = !!solid;
    group.add(m);
    return m;
  }
  /** blocking box centred (x,z) size w x d, from y0 to y0+h */
  function box(x, z, w, d, h, y0, color, name, solid = true) {
    addMesh(new THREE.BoxGeometry(w, h, d), mat(color), x, y0 + h / 2, z, true);
    if (solid) {
      const b = new THREE.Box3(new THREE.Vector3(x - w / 2, y0, z - d / 2), new THREE.Vector3(x + w / 2, y0 + h, z + d / 2));
      b.name = name || 'box';
      colliders.push(b);
    }
  }
  /** walkable slab (visual + floor height), top at y */
  function platform(x, z, w, d, y, color, thick = 3) {
    addMesh(new THREE.BoxGeometry(w, thick, d), mat(color), x, y - thick / 2, z, true);
    floors.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y });
  }
  /** ramp rising along axis from `from` coordinate (y0) to `to` coordinate (y1) */
  function ramp(cx, cz, w, d, axis, y0, y1) {
    const r = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, axis, y0, y1 };
    ramps.push(r);
    const len = axis === 'x' ? w : d, rise = y1 - y0, hyp = Math.hypot(len, rise), ang = Math.atan2(rise, len);
    const g = new THREE.BoxGeometry(axis === 'x' ? hyp : w, 0.4, axis === 'x' ? d : hyp);
    const m = addMesh(g, mat(palette.ramp), cx, (y0 + y1) / 2 - 0.2, cz, true);
    if (axis === 'x') m.rotation.z = ang; else m.rotation.x = -ang;
    // side skirts so ramps do not look hollow
    const sk = new THREE.BoxGeometry(axis === 'x' ? len : 0.3, Math.max(y0, y1), axis === 'x' ? 0.3 : len);
    void sk; // (kept simple: low-poly ramps are slabs)
  }
  function wallBox(x, z, w, d, h, color, name) { box(x, z, w, d, h, 0, color, name || 'wall'); }

  // ---------- base island ----------
  const waterMat = new THREE.MeshBasicMaterial({ color: 0x4fc9ee }); mats.push(waterMat);
  const water = addMesh(new THREE.BoxGeometry(400, 1, 400), waterMat, 0, -2, 0, false);
  water.castShadow = false; water.name = 'water';
  addMesh(new THREE.BoxGeometry(HALF * 2 + 4, 2, HALF * 2 + 4), mat(palette.sand), 0, -1, 0, false).name = 'beach';
  const grassTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#7fd08a'; x.fillRect(0, 0, 128, 128);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++) { x.fillStyle = rnd() < 0.5 ? '#8fdc98' : '#6dc279'; const w = 6 + rnd() * 14; x.fillRect(rnd() * 128, rnd() * 128, w, w * 0.6); }
    for (let i = 0; i < 40; i++) { x.fillStyle = '#5fb56d'; const px = rnd() * 128, py = rnd() * 128; x.fillRect(px, py, 2, 5); x.fillRect(px + 3, py + 1, 2, 4); }
    x.strokeStyle = 'rgba(40,110,70,.18)'; x.lineWidth = 2; x.strokeRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 16); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const groundMat = new THREE.MeshLambertMaterial({ map: grassTex }); mats.push(groundMat);
  addMesh(new THREE.BoxGeometry(HALF * 2, 0.4, HALF * 2), groundMat, 0, -0.2, 0, true).name = 'ground';
  floors.push({ minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF, y: 0 });

  // perimeter low walls (also colliders) with gaps nowhere: closed arena
  const P = HALF + 0.5;
  box(0, -P, HALF * 2 + 2, 1, 3, 0, 0xfff0d8, 'edge');
  box(0, P, HALF * 2 + 2, 1, 3, 0, 0xfff0d8, 'edge');
  box(-P, 0, 1, HALF * 2 + 2, 3, 0, 0xfff0d8, 'edge');
  box(P, 0, 1, HALF * 2 + 2, 3, 0, 0xfff0d8, 'edge');

  // ---------- centre rooftop "tower deck" (sniper perch) ----------
  platform(0, 0, 12, 12, ROOF, palette.roof);
  ramp(-10, 0, 8, 4, 'x', 0, ROOF);  // west ramp (rising toward +x)
  ramp(10, 0, 8, 4, 'x', ROOF, 0);   // east ramp (descending toward +x)
  // low cover rim on the deck (gaps at ramp sides)
  box(0, -5.7, 12, 0.6, 1.1, ROOF, palette.wallB, 'deckrim');
  box(0, 5.7, 12, 0.6, 1.1, ROOF, palette.wallB, 'deckrim');
  box(-1.5, 0, 1.2, 3, 1.1, ROOF, palette.crate, 'deckcrate');
  box(2.5, -2.5, 1.6, 1.6, 1.4, ROOF, palette.crate2, 'deckcrate');

  // ---------- Site A (NW, ground) ----------
  const A = new THREE.Vector3(-19, 0, -19);
  addMesh(new THREE.CylinderGeometry(5, 5, 0.06, 6), mat(palette.siteA), A.x, 0.05, A.z, false).name = 'siteA_marker';
  box(-24.5, -19, 1, 8, 2.6, 0, palette.wall, 'A_back');
  box(-19, -24.5, 8, 1, 2.6, 0, palette.wall, 'A_back');
  box(-21, -16, 2, 2, 1.4, 0, palette.crate, 'A_crate');
  box(-16.5, -20.5, 1.6, 2.6, 1.4, 0, palette.crate2, 'A_crate');
  box(-19.2, -19.2, 1.2, 1.2, 0.9, 0, palette.crate, 'A_boxsmall');
  box(-13, -13, 1.2, 1.2, 2.6, 0, palette.dark, 'A_pillar');

  // ---------- Site B (SE, rooftop) ----------
  platform(20, 20, 14, 14, ROOF, palette.roof);
  ramp(20, 10.5, 4, 5, 'z', 0, ROOF);          // ramp from north (z smaller) up toward south
  ramp(11.5, 24, 5, 4, 'x', 0, ROOF);          // ramp from west up toward east
  const B = new THREE.Vector3(20, ROOF, 21);
  addMesh(new THREE.CylinderGeometry(4.5, 4.5, 0.06, 6), mat(palette.siteB), B.x, ROOF + 0.05, B.z, false).name = 'siteB_marker';
  // railings: south & east edge (solid), north/west partially
  box(20, 26.7, 14, 0.5, 1.2, ROOF, palette.wallB, 'B_rail');
  box(26.7, 20, 0.5, 14, 1.2, ROOF, palette.wallB, 'B_rail');
  box(13.3, 17, 0.5, 6, 1.2, ROOF, palette.wallB, 'B_rail');
  box(24, 14.2, 6, 0.5, 1.2, ROOF, palette.wallB, 'B_rail');
  box(17, 18.5, 1.8, 1.8, 1.3, ROOF, palette.crate, 'B_crate');
  box(23, 22, 2.4, 1.2, 1.3, ROOF, palette.crate2, 'B_crate');
  box(20.2, 21.2, 1.0, 1.0, 0.8, ROOF, palette.crate, 'B_boxsmall');

  // ---------- Mid buildings / lane walls (ground) ----------
  // west "shop": three walls with door gap south
  wallBox(-18, 3, 9, 0.8, 3, palette.wall, 'shopN');
  wallBox(-22.2, 6.5, 0.8, 7, 3, palette.wall, 'shopW');
  wallBox(-13.8, 6.5, 0.8, 7, 3, palette.wall, 'shopE');
  wallBox(-20.5, 10, 3.5, 0.8, 3, palette.wall, 'shopS1');
  wallBox(-15.5, 10, 3.5, 0.8, 3, palette.wall, 'shopS2');
  box(-18, 6.5, 1.8, 1.8, 1.2, 0, palette.crate, 'shop_crate');
  // east "garage"
  wallBox(18, -4, 9, 0.8, 3, palette.wallB, 'garN');
  wallBox(22.2, -8, 0.8, 8, 3, palette.wallB, 'garE');
  wallBox(14.4, -9, 0.8, 6, 3, palette.wallB, 'garW');
  box(18, -8, 2.2, 1.4, 1.2, 0, palette.crate2, 'gar_crate');
  // long mid walls to make lanes
  wallBox(-7, -14, 0.8, 8, 2.4, palette.wallC, 'laneW');
  wallBox(7, 14, 0.8, 8, 2.4, palette.wallC, 'laneE');
  // scattered cover
  const crates = [[-4, 12, 2, 2, 1.3], [5, -12, 2, 2, 1.3], [-27, -4, 2.4, 2, 1.3], [27, 6, 2.4, 2, 1.3],
    [-9, 22, 1.8, 1.8, 1.2], [10, -22, 1.8, 1.8, 1.2], [-1, -19, 3, 1, 1.0], [1, 19, 3, 1, 1.0], [-27, 22, 2, 2, 1.3], [28, -22, 2, 2, 1.3]];
  crates.forEach(([x, z, w, d, h], i) => box(x, z, w, d, h, 0, i % 2 ? palette.crate2 : palette.crate, 'cover'));

  // palms (decor, trunk collides lightly via thin box)
  const palms = [[-29, -29], [29, -29], [-29, 29], [-3, 29], [3, -29], [29, 12], [-29, 14]];
  palms.forEach(([x, z]) => {
    box(x, z, 0.5, 0.5, 3, 0, palette.trunk, 'palm');
    addMesh(new THREE.ConeGeometry(2, 1.6, 5), mat(palette.palm), x, 3.5, z, false);
    addMesh(new THREE.ConeGeometry(1.4, 1.3, 5), mat(palette.palm), x, 4.5, z, false);
  });

  // ---------- spawns ----------
  const sp = (x, z, yaw, team) => ({ position: new THREE.Vector3(x, 0, z), yaw, team });
  const spawnPoints = [
    sp(0, 28, Math.PI, 'T'), sp(-6, 28, Math.PI, 'T'), sp(6, 28, Math.PI, 'T'), sp(-12, 26, Math.PI, 'T'), sp(12, 29, Math.PI, 'T'),
    sp(0, -28, 0, 'CT'), sp(6, -28, 0, 'CT'), sp(-6, -28, 0, 'CT'), sp(12, -26, 0, 'CT'), sp(3, -25, 0, 'CT')
  ];

  // ---------- lights ----------
  const lights = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0xcdeeff, 0xf2d9a0, 0.9);
  const sun = new THREE.DirectionalLight(0xfff1d6, 0.9);
  sun.position.set(25, 40, 15); sun.castShadow = true;
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45; sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
  sun.shadow.mapSize.set(1024, 1024);
  lights.add(hemi, sun); group.add(lights);

  // ---------- height query ----------
  function getHeight(x, z) {
    let h = -Infinity;
    for (const f of floors) if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ && f.y > h) h = f.y;
    for (const r of ramps) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
      const t = r.axis === 'x' ? (x - r.minX) / (r.maxX - r.minX) : (z - r.minZ) / (r.maxZ - r.minZ);
      const y = r.y0 + (r.y1 - r.y0) * t;
      if (y > h) h = y;
    }
    return h;
  }
  // ground floor must not apply under rooftops for height: rooftop floor y wins via max. (Walking under a roof is not supported;
  // roofs are solid slabs, platforms are 3m thick.) Solid slab interior is blocked in nav below.

  // ---------- nav grid ----------
  const cs = 1, cols = HALF * 2, rows = HALF * 2, originX = -HALF, originZ = -HALF;
  const walkable = new Uint8Array(cols * rows), height = new Float32Array(cols * rows);
  const AGENT = 0.45;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = originX + (c + 0.5) * cs, z = originZ + (r + 0.5) * cs, y = getHeight(x, z);
    height[r * cols + c] = y;
    let ok = y > -Infinity;
    if (ok) for (const b of colliders) {
      if (x > b.min.x - AGENT && x < b.max.x + AGENT && z > b.min.z - AGENT && z < b.max.z + AGENT && b.max.y > y + 0.5 && b.min.y < y + 1.7) { ok = false; break; }
    }
    walkable[r * cols + c] = ok ? 1 : 0;
  }
  const navGrid = {
    cellSize: cs, cols, rows, originX, originZ, walkable, height,
    worldToCell(x, z) { return [Math.floor((x - originX) / cs), Math.floor((z - originZ) / cs)]; },
    cellToWorld(c, r) { return new THREE.Vector3(originX + (c + 0.5) * cs, height[r * cols + c], originZ + (r + 0.5) * cs); },
    isWalkable(c, r) { return c >= 0 && r >= 0 && c < cols && r < rows && walkable[r * cols + c] === 1; },
    randomWalkable() {
      for (let i = 0; i < 500; i++) { const c = (Math.random() * cols) | 0, r = (Math.random() * rows) | 0; if (this.isWalkable(c, r)) return this.cellToWorld(c, r); }
      return this.cellToWorld(cols >> 1, rows >> 1);
    },
    findPath(from, to) {
      const g = this;
      const nearest = (v) => { // snap to closest walkable cell
        let [c, r] = g.worldToCell(v.x, v.z);
        c = Math.min(cols - 1, Math.max(0, c)); r = Math.min(rows - 1, Math.max(0, r));
        if (g.isWalkable(c, r)) return [c, r];
        for (let k = 1; k < 8; k++) for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) if (g.isWalkable(c + dc, r + dr)) return [c + dc, r + dr];
        return null;
      };
      const s = nearest(from), e = nearest(to);
      if (!s || !e) return [];
      const N = cols * rows, gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
      const idx = (c, r) => r * cols + c, si = idx(s[0], s[1]), ei = idx(e[0], e[1]);
      const hf = (i) => Math.hypot((i % cols) - e[0], ((i / cols) | 0) - e[1]);
      const open = [[hf(si), si]]; gs[si] = 0;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      while (open.length) {
        let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
        const cur = open.splice(bi, 1)[0][1];
        if (closed[cur]) continue; closed[cur] = 1;
        if (cur === ei) break;
        const cc = cur % cols, cr = (cur / cols) | 0;
        for (const [dc, dr] of dirs) {
          const nc = cc + dc, nr = cr + dr;
          if (!g.isWalkable(nc, nr)) continue;
          if (dc && dr && !(g.isWalkable(cc + dc, cr) && g.isWalkable(cc, cr + dr))) continue;
          const ni = idx(nc, nr);
          if (Math.abs(height[ni] - height[cur]) > STEP) continue;
          const ng = gs[cur] + (dc && dr ? 1.4142 : 1);
          if (ng < gs[ni]) { gs[ni] = ng; came[ni] = cur; open.push([ng + hf(ni), ni]); }
        }
      }
      if (!closed[ei]) return [];
      const out = []; for (let i = ei; i !== -1; i = came[i]) out.push(g.cellToWorld(i % cols, (i / cols) | 0));
      out.reverse(); return out;
    }
  };

  return {
    group, lights, colliders, getHeight, stepHeight: STEP, spawnPoints, navGrid, floors, ramps,
    bombsites: {
      A: { center: A.clone(), radius: 5, box: new THREE.Box3(new THREE.Vector3(A.x - 5, -1, A.z - 5), new THREE.Vector3(A.x + 5, 3, A.z + 5)) },
      B: { center: B.clone(), radius: 4.5, box: new THREE.Box3(new THREE.Vector3(B.x - 4.5, ROOF - 1, B.z - 4.5), new THREE.Vector3(B.x + 4.5, ROOF + 3, B.z + 4.5)) }
    },
    bounds: { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF },
    sky: { background: 0x9fdcff, fog: { color: 0xbfe8ff, near: 60, far: 160 } },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); }
  };
}
export default buildMap;
