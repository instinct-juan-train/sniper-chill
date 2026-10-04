// bots.js - simple enemy bots for Sniper Chill (patrol, spot, chase, shoot, one defuser).
// createBots(THREE, scene, map, { raycast, colliders }) -> manager
//   manager.list            targets for hitscan {id, position:{x,y,z feet}, height, radius, health, alive}
//   manager.spawn(pos, opts) / manager.clear()
//   manager.update(dt, env) env = {playerEye:{x,y,z}, playerAlive, bomb:{planted,pos,defuse(dt)}, camera}
//        returns events [{type:'shot', from, to, hit:bool, damage}, {type:'defused'}]
//   manager.damage(bot, newHealth, headshot)
//   manager.aliveCount()
export function createBots(THREE, scene, map, opts) {
  const { raycast, colliders } = opts;
  const list = [];
  let nextId = 1;
  const palette = [0xe85d75, 0xf2a65a, 0x6c8cff, 0x8e6cf0, 0x3fb68b];
  const skin = new THREE.MeshLambertMaterial({ color: 0xf0c3a0, flatShading: true });
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x2b2f3a, flatShading: true });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function makeBar() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 8;
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    spr.scale.set(0.9, 0.11, 1); spr.renderOrder = 10;
    const draw = (f) => {
      const x = c.getContext('2d'); x.clearRect(0, 0, 64, 8); x.fillStyle = '#10141f'; x.fillRect(0, 0, 64, 8);
      x.fillStyle = f > 0.5 ? '#52f0a0' : f > 0.25 ? '#ffd24a' : '#ff5566'; x.fillRect(1, 1, 62 * f, 6); tex.needsUpdate = true;
    };
    draw(1); return { spr, draw };
  }

  function spawn(pos, o = {}) {
    const col = palette[(nextId - 1) % palette.length];
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: col, flatShading: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.32), bodyMat); body.position.y = 1.0; group.add(body);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.28), new THREE.MeshLambertMaterial({ color: 0x2f3550, flatShading: true })); legs.position.y = 0.3; group.add(legs);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin); head.position.y = 1.62; group.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.55), gunMat); gun.position.set(0.28, 1.1, -0.3); group.add(gun);
    const bar = makeBar(); bar.spr.position.y = 2.05; group.add(bar.spr);
    group.position.set(pos.x, pos.y, pos.z); scene.add(group);
    const b = {
      id: 'bot' + nextId++, group, bodyMat, baseColor: col, bar,
      position: { x: pos.x, y: pos.y, z: pos.z }, height: 1.8, radius: 0.3,
      health: 100, alive: true, defuser: !!o.defuser, path: [], pathT: Math.random(), seen: 0,
      shootT: 1 + Math.random(), yaw: 0, flash: 0, deadT: 0, defuseT: 0, speedMul: 0.85 + Math.random() * 0.3,
    };
    list.push(b); return b;
  }
  function clear() { for (const b of list) scene.remove(b.group); list.length = 0; }
  function damage(b, newHealth, head) {
    b.health = newHealth; b.bar.draw(Math.max(0, newHealth) / 100); b.flash = 0.12;
    if (newHealth <= 0) { b.alive = false; b.deadT = 0; b.bar.spr.visible = false; }
  }
  function aliveCount() { let n = 0; for (const b of list) if (b.alive) n++; return n; }

  function setPath(b, to) {
    const p = map.navGrid.findPath(V(b.position.x, b.position.y, b.position.z), to);
    b.path = p.slice(1);
  }
  function step(b, dt, speed) {
    const wp = b.path[0]; if (!wp) return false;
    const dx = wp.x - b.position.x, dz = wp.z - b.position.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { b.path.shift(); return b.path.length > 0; }
    const m = Math.min(d, speed * dt);
    b.position.x += dx / d * m; b.position.z += dz / d * m;
    const h = map.getHeight(b.position.x, b.position.z);
    if (isFinite(h)) b.position.y += (h - b.position.y) * Math.min(1, dt * 12);
    b.yaw = Math.atan2(-dx, -dz);
    return true;
  }

  function update(dt, env) {
    const events = [];
    for (const b of list) {
      if (!b.alive) {
        b.deadT += dt; b.group.rotation.x = -Math.min(Math.PI / 2, b.deadT * 4);
        if (b.deadT > 4) b.group.visible = false;
        continue;
      }
      b.flash = Math.max(0, b.flash - dt); b.bodyMat.emissive.setHex(b.flash > 0 ? 0xffffff : 0x000000);
      const eye = { x: b.position.x, y: b.position.y + 1.6, z: b.position.z };
      let sees = false, dist = 999, dx = 0, dy = 0, dz = 0;
      if (env.playerAlive) {
        dx = env.playerEye.x - eye.x; dy = env.playerEye.y - eye.y; dz = env.playerEye.z - eye.z; dist = Math.hypot(dx, dy, dz);
        if (dist < 50) sees = !raycast(eye, { x: dx, y: dy, z: dz }, { colliders, maxDistance: dist - 0.3 });
      }
      b.seen = sees ? b.seen + dt : Math.max(0, b.seen - dt * 0.5);
      b.pathT -= dt;
      const bomb = env.bomb;
      if (sees && b.seen > 0.55) {
        b.yaw = Math.atan2(-dx, -dz);
        if (dist > 16) {
          if (b.pathT <= 0 || !b.path.length) { setPath(b, V(env.playerEye.x, env.playerEye.y - 1.6, env.playerEye.z)); b.pathT = 1.1 + Math.random() * 0.4; }
          step(b, dt, 3.0 * b.speedMul);
        }
        b.shootT -= dt;
        if (b.shootT <= 0) {
          b.shootT = 0.85 + Math.random() * 0.6;
          const p = Math.max(0.12, Math.min(0.65, 0.72 - dist * 0.012));
          const hit = Math.random() < p;
          events.push({ type: 'shot', from: V(eye.x, eye.y - 0.1, eye.z), to: V(env.playerEye.x, env.playerEye.y, env.playerEye.z), hit, damage: 9 });
        }
      } else if (b.defuser && bomb && bomb.planted) {
        const bd = Math.hypot(bomb.pos.x - b.position.x, bomb.pos.z - b.position.z);
        if (bd > 1.8) {
          if (b.pathT <= 0 || !b.path.length) { setPath(b, V(bomb.pos.x, bomb.pos.y, bomb.pos.z)); b.pathT = 2; }
          step(b, dt, 3.6 * b.speedMul);
        } else if (bomb.defuse(dt)) events.push({ type: 'defused' });
      } else {
        if (!b.path.length || b.pathT <= -8) {
          const tgt = Math.random() < 0.4 && map.bombsites ? (Math.random() < 0.5 ? map.bombsites.A.center : map.bombsites.B.center) : map.navGrid.randomWalkable();
          setPath(b, V(tgt.x, tgt.y, tgt.z)); b.pathT = 0;
        }
        step(b, dt, 2.2 * b.speedMul);
      }
      b.group.position.set(b.position.x, b.position.y, b.position.z); b.group.rotation.y = b.yaw;
    }
    return events;
  }
  return { list, spawn, clear, update, damage, aliveCount };
}
