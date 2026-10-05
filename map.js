/** KITE GARDEN - an original pastel competitive garden-town. Drop-in Three.js r160 map.
 * Coordinates: 64x64m, T south, CT north. All heights are single-layer.
 * Contested market mid, window balcony, orchard alleys and two multi-entry sites.
 * No imports/assets/network requests. All materials/geometries/textures disposed.
 */
export function buildMap(THREE) {
  const group = new THREE.Group(); group.name = 'Kite Garden';
  const colliders=[], floors=[], ramps=[], geos=new Set(), mats=new Set(), textures=[];
  const STEP=.7, HALF=32;
  const C={ground:0x91c990, tile:0xe2d2b4, edge:0xb2c4a0, metal:0x6d8494, roof:0xc48576, cream:0xffedce,
    coral:0xff846e, cyan:0x68e3db, purple:0xc8b3cb, green:0x73b787, gold:0xffda8d};
  const cache=new Map();
  function material(color, basic=false) {
    const key=color+':'+basic;
    if(!cache.has(key)){const m=basic?new THREE.MeshBasicMaterial({color}):new THREE.MeshLambertMaterial({color,flatShading:true});cache.set(key,m);mats.add(m);} return cache.get(key);
  }
  function mesh(g,m,x,y,z,solid=false,name='detail') {
    geos.add(g); const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.userData.solid=solid;
    o.name=name;o.castShadow=solid;o.receiveShadow=true;group.add(o);return o;
  }
  function box(x,z,w,d,h,y,color,name='cover',blocking=true) {
    const o=mesh(new THREE.BoxGeometry(w,h,d),material(color),x,y+h/2,z,true,name);
    if(blocking){const b=new THREE.Box3(new THREE.Vector3(x-w/2,y,z-d/2),new THREE.Vector3(x+w/2,y+h,z+d/2));b.name=name;colliders.push(b);}return o;
  }
  function detail(x,y,z,w,h,d,color){return mesh(new THREE.BoxGeometry(w,h,d),material(color,true),x,y,z,false);}
  function platform(x,z,w,d,y,color=C.tile) {
    box(x,z,w,d,y===0?.55:.18,y===0?-.55:y-.18,color,'walkable deck',false);
    floors.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,y});
    if(y>0)detail(x,y+.015,z,w,.025,d,C.tile);
  }
  function ramp(x,z,w,d,axis,y0,y1) {
    const r={minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,axis,y0,y1};ramps.push(r);
    const a=axis==='x'; const verts=[[-w/2,y0,-d/2],[w/2,a?y1:y0,-d/2],[w/2,y1,d/2],[-w/2,a?y0:y1,d/2]];
    const p=[]; const bottom=verts.map(v=>[v[0],v[1]-.18,v[2]]); const all=[...verts,...bottom];
    for(const face of [[0,3,2],[0,2,1],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7],[4,5,6],[4,6,7]])for(const i of face)p.push(...all[i]);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();mesh(g,material(C.purple),x,0,z,true,'access ramp');
    // Thin contrasting guides follow the same mathematical slope as the floor.
    for(const s of [-1,1]){const length=a?w:d, rise=y1-y0;
      const strip=mesh(new THREE.BoxGeometry(a?Math.hypot(length,rise):.075,.025,a?.075:Math.hypot(length,rise)),material(C.cyan,true),a?x:x+s*(w/2-.18),(y0+y1)/2+.04,a?z+s*(d/2-.18):z);
      if(a)strip.rotation.z=Math.atan2(rise,length);else strip.rotation.x=-Math.atan2(rise,length);
    }
  }
  function label(text,x,y,z,color,width=4,rotation=0) {
    const c=document.createElement('canvas');c.width=512;c.height=160;const ctx=c.getContext('2d');
    ctx.fillStyle='#182839';ctx.fillRect(0,0,512,160);ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.fillRect(0,0,12,160);
    ctx.font='bold 72px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,262,82);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;textures.push(tex);
    const m=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide});mats.add(m);
    const o=mesh(new THREE.PlaneGeometry(width,width*160/512),m,x,y,z,false,'wayfinding');o.rotation.y=rotation;
  }
  function cover(x,z,w=3,d=1.7,h=1.2,y=0,color=C.cream) {
    box(x,z,w,d,h,y,color,'planter / cover');detail(x,y+h-.12,z,w+.04,.12,d+.04,C.metal);
    // Small sculptural plants keep silhouettes clear above chest-height cover.
    for(let i=0;i<3;i++)mesh(new THREE.BufferGeometry().copy(new THREE.ConeGeometry(.38,.55,5)),material(C.green),x+(i-1)*w*.22,y+h+.2,z,false,'plant');
  }
  // KITE GARDEN: original competitive garden-town, two distinct courtyards.
  platform(0,0,64,64,0,C.ground);group.children[0].name='ground';
  for(const [x,z,w,d]of[[0,-32.5,66,1],[0,32.5,66,1],[-32.5,0,1,64],[32.5,0,1,64]])box(x,z,w,d,3.5,0,C.cream,'perimeter');
  const path=(x,z,w,d)=>detail(x,.03,z,w,.045,d,0xe8d8b5);
  // Alleys frame three entry channels. Players always have cover and a flank.
  path(0,24,48,8);path(0,-23,54,7);path(-24,0,7,48);path(24,0,7,48);
  path(0,0,12,44);path(-11,-6,14,5);path(12,5,16,5);
  path(-19,-12,20,19);path(21,-6,18,19);path(-12,11,10,5);path(12,-14,10,5);
  function house(x,z,w,d,h,color,name){
    box(x,z,w,d,h,0,color,name);box(x,z,w+.35,d+.35,.24,h,C.roof,name+' roof',false);
    // Roof slabs are not walkable and use a matching box collider.
    const r=new THREE.Box3(new THREE.Vector3(x-w/2-.175,h,z-d/2-.175),new THREE.Vector3(x+w/2+.175,h+.24,z+d/2+.175));r.name=name+' roof';colliders.push(r);
    detail(x,h-.45,z+d/2+.015,w*.75,.12,.04,C.cream);
  }
  // Offset building masses form original irregular lanes, not a copied map.
  house(-12,21,11,7,5.2,C.coral,'south bakery');house(12,20,10,8,5.6,C.cyan,'south pottery');
  house(-13,7,11,7,5.4,C.cream,'orchard house');house(-13,-17,10,7,5.4,C.coral,'north bell house');
  house(14,12,10,7,5.1,C.cyan,'tea house');house(12,-5,7,10,5.8,C.cream,'market house');
  house(-28,12,3,9,4.4,C.coral,'outer orchard wall');house(28,14,3,8,4.6,C.cyan,'outer garden wall');
  house(-2,-26,8,4,4.8,C.cream,'defender lodge');
  // Mid has an open long angle but covered sidesteps and two offset connectors.
  cover(-2,9,2.2,1.8,1.15,0,C.coral);cover(2,-7,2.2,1.8,1.15,0,C.cyan);
  box(-6,1,1,7,3,0,C.cream,'west mid angle');box(6,14,1,5,3,0,C.coral,'east mid angle');
  // The window balcony faces mid from the northern side. Front cover is split
  // around a 3m shooting window; side entry and rear ramp let attackers flank it.
  platform(0,-16,10,6,3,C.purple);ramp(8,-16,6,4,'x',3,0);
  box(-3.6,-13.15,2.8,.45,2.5,3,C.cream,'window left');box(3.6,-13.15,2.8,.45,2.5,3,C.cream,'window right');
  box(0,-13.15,4.4,.45,.8,3,C.cream,'window sill');box(0,-13.15,10,.45,.5,5.5,C.roof,'window lintel');
  label('MID / MARKET',0,6.6,-13.4,C.coral,4);
  // A: ground bell courtyard. Entries: orchard long, west connector, rear alley.
  const A=new THREE.Vector3(-22,0,-9),B=new THREE.Vector3(22,2,-7);
  // B: raised greenhouse terrace. Entries: garden long, south connector, rear ramp.
  platform(22,-7,12,14,2,C.tile);ramp(22,4,4,8,'z',2,0);ramp(22,-18,4,8,'z',0,2);
  function site(v,color,letter){
    mesh(new THREE.CylinderGeometry(4,4,.06,32),material(color),v.x,v.y+.04,v.z,false,'site '+letter);
    const ring=mesh(new THREE.TorusGeometry(3.7,.05,4,48),material(C.cream,true),v.x,v.y+.085,v.z);ring.rotation.x=Math.PI/2;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#344359';ctx.font='bold 175px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(letter,128,135);
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);const m=new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false});mats.add(m);const l=mesh(new THREE.PlaneGeometry(2.8,2.8),m,v.x,v.y+.085,v.z);l.rotation.x=-Math.PI/2;
  }
  site(A,C.coral,'A');site(B,C.cyan,'B');
  cover(-24,-6,2.6,1.6,1.15);cover(-19,-11,2.6,1.6,1.25);cover(24,-5,2.6,1.6,1.15,2);cover(19,-10,2.6,1.6,1.25,2);
  // Bell landmark is outside the circular plant zone and makes A unmistakable.
  box(-28,-13,3,3,6.2,0,C.coral,'bell tower');
  mesh(new THREE.BufferGeometry().copy(new THREE.ConeGeometry(2.5,2,4)),material(C.roof),-28,7.2,-13,true,'bell roof');
  mesh(new THREE.SphereGeometry(.7,8,6),material(C.gold),-28,5.3,-11.45,false,'bell');label('A / CHIME',-26.45,3.8,-13,C.cream,4,Math.PI/2);
  house(29,-10,2.5,9,6,C.cyan,'greenhouse');
  for(let z=-13;z<=-7;z+=1.5)detail(27.72,4.4,z,.08,2.6,.5,C.cream);
  label('B / BLOOM',27.60,3.9,-10,C.cream,4,-Math.PI/2);
  // Off-angle garden cover plus one protected short route to each site.
  cover(-25,19,2.5,1.6,1.15,0,C.coral);cover(25,20,2.5,1.6,1.15,0,C.cyan);
  box(-18,1,1,6,2.8,0,C.coral,'A connector elbow');box(18,9,1,4,2.8,0,C.cyan,'B connector elbow');
  cover(-11,-7,2.6,1.4,1.2);cover(10,-20,2.6,1.4,1.2);cover(-20,-25,2.6,1.4,1.2);cover(0,24,3,1.4,1.2);
  label('CHIME ←',-13,2,10.53,C.coral,4);label('→ BLOOM',14,2,7.48,C.cyan,4,Math.PI);
  // Flankable orchard perch: cannot cover both sites and mid at once.
  platform(-24,5,7,6,2.4,C.tile);ramp(-24,12,4,8,'z',2.4,0);
  cover(-26,5,1.5,2,1,2.4,C.coral);
  // Round toy trees with short, opaque trunks. Their crowns are non-solid decor.
  for(const[x,z]of[[-30,26],[30,26],[-30,-26],[30,-26],[-5,22],[5,23],[-22,-29],[21,-29]]){
    box(x,z,.5,.5,2.7,0,0x8d7061,'tree trunk');mesh(new THREE.IcosahedronGeometry(1.7,1),material(C.green),x,3.5,z,false,'tree');
  }
  // Outside scenery: distant grass hills and white cloud puffs, all non-solid.
  for(const[x,z,r]of[[-60,-80,30],[45,-85,40],[-90,10,35],[90,10,30]])mesh(new THREE.SphereGeometry(r,16,8),material(0x92baa1),x,-r*.6,z,false,'hill');

  // The signature skyline: giant origami kites tethered to each landmark.
  // They sit well above combat space and intentionally do not stop shots.
  function kite(x,y,z,size,color){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,size,0,-size*.7,0,0,0,0,.4, size*.7,0,0,0,size,0,0,0,.4, 0,-size*1.1,0,size*.7,0,0,0,0,.4, -size*.7,0,0,0,-size*1.1,0,0,0,.4],3));g.computeVertexNormals();
    const km=new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide,flatShading:true});mats.add(km);const o=mesh(g,km,x,y,z,false,'signature kite');o.rotation.y=.25;
    const points=[new THREE.Vector3(x,y-size,z),new THREE.Vector3(x+.9,y-size-2,z),new THREE.Vector3(x-.5,y-size-4,z),new THREE.Vector3(x+.5,y-size-6,z)];
    const tail=new THREE.CatmullRomCurve3(points);mesh(new THREE.TubeGeometry(tail,20,.055,4,false),material(C.cream),0,0,0,false,'kite tail');
    for(let i=0;i<3;i++){const bow=mesh(new THREE.OctahedronGeometry(.35,0),material(i%2?C.cyan:C.coral),x+(i%2?.7:-.3),y-size-2-i*1.5,z,false,'ribbon');bow.scale.set(1.6,.45,.25);}
  }
  kite(-26,15,-15,3.8,C.coral);kite(26,14,-9,3.2,C.cyan);
  kite(-55,22,-70,4,C.gold);kite(40,30,-85,5,C.coral);
  const spawnPoints=[];
  for(const team of ['T','CT'])for(const x of [0,-4,4,-8,8])spawnPoints.push({position:new THREE.Vector3(x,0,team==='T'?28:-30),yaw:team==='T'?Math.PI:0,team});
  const lights=new THREE.Group();lights.add(new THREE.HemisphereLight(0xcceeff,0x8cad72,2));
  const sun=new THREE.DirectionalLight(0xfff3df,2);sun.position.set(-30,55,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:140});sun.shadow.bias=-.001;sun.shadow.normalBias=.025;lights.add(sun);group.add(lights);
  function getHeight(x,z){
    if(x<-HALF||x>HALF||z<-HALF||z>HALF)return -Infinity;
    let h=0;for(const f of floors)if(x>=f.minX&&x<=f.maxX&&z>=f.minZ&&z<=f.maxZ)h=Math.max(h,f.y);
    for(const r of ramps)if(x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ){const t=r.axis==='x'?(x-r.minX)/(r.maxX-r.minX):(z-r.minZ)/(r.maxZ-r.minZ);h=Math.max(h,r.y0+(r.y1-r.y0)*t);}return h;
  }
  // Top-surface navigation. Radius inflation and diagonal height checks prevent
  // corner cutting, including shortcuts across the steep sides of ramps.
  const cs=1,cols=64,rows=64,originX=-32,originZ=-32;
  const walkable=new Uint8Array(cols*rows),height=new Float32Array(cols*rows),valid=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x=originX+c+.5,z=originZ+r+.5,y=getHeight(x,z),i=r*cols+c;height[i]=y;
    walkable[i]=Number.isFinite(y)&&!colliders.some(b=>x>b.min.x-.45&&x<b.max.x+.45&&z>b.min.z-.45&&z<b.max.z+.45&&b.max.y>y+.5&&b.min.y<y+1.8)?1:0;
    if(walkable[i])valid.push(i);
  }
  const navGrid={cellSize:cs,cols,rows,originX,originZ,walkable,height,
    worldToCell(x,z){return[Math.floor(x-originX),Math.floor(z-originZ)];},
    cellToWorld(c,r){return new THREE.Vector3(originX+c+.5,height[r*cols+c],originZ+r+.5);},
    isWalkable(c,r){return c>=0&&r>=0&&c<cols&&r<rows&&walkable[r*cols+c]===1;},
    randomWalkable(){const i=valid[Math.floor(Math.random()*valid.length)];return this.cellToWorld(i%cols,Math.floor(i/cols));},
    findPath(from,to){
      const nearest=v=>{let[c,r]=this.worldToCell(v.x,v.z);c=Math.max(0,Math.min(63,c));r=Math.max(0,Math.min(63,r));
        for(let k=0;k<10;k++){let best=-1,dist=Infinity;for(let dr=-k;dr<=k;dr++)for(let dc=-k;dc<=k;dc++)if(this.isWalkable(c+dc,r+dr)){
          const i=(r+dr)*cols+c+dc,d=dc*dc+dr*dr+Math.abs(height[i]-v.y)*4;if(d<dist){dist=d;best=i;}}
          if(best>=0)return best;}return -1;};
      const start=nearest(from),end=nearest(to);if(start<0||end<0)return[];
      const g=new Float32Array(4096).fill(Infinity),prev=new Int32Array(4096).fill(-1),closed=new Uint8Array(4096),open=[];
      const h=i=>Math.hypot(i%64-end%64,Math.floor(i/64)-Math.floor(end/64));g[start]=0;open.push([h(start),start]);
      const pass=(c,r,i)=>this.isWalkable(c,r)&&Math.abs(height[r*64+c]-height[i])<=STEP;
      while(open.length){let bi=0;for(let k=1;k<open.length;k++)if(open[k][0]<open[bi][0])bi=k;
        const i=open.splice(bi,1)[0][1];if(closed[i])continue;closed[i]=1;if(i===end)break;const c=i%64,r=Math.floor(i/64);
        for(const[dc,dr]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
          const nc=c+dc,nr=r+dr;if(!pass(nc,nr,i))continue;
          if(dc&&dr&&(!pass(c+dc,r,i)||!pass(c,r+dr,i)))continue;
          const ni=nr*64+nc,cost=g[i]+Math.hypot(dc,dr)+Math.abs(height[ni]-height[i])*.15;
          if(cost<g[ni]){g[ni]=cost;prev[ni]=i;open.push([cost+h(ni),ni]);}
        }
      }
      if(!closed[end])return[];const out=[];for(let i=end;i>=0;i=prev[i])out.push(this.cellToWorld(i%64,Math.floor(i/64)));return out.reverse();
    }
  };
  // Explicit physics surfaces. Integration must prefer these over synthesized
  // legacy 3m-deep roof boxes. surfaceOnly ramps need thin-slab ray intersections.
  const physicsColliders=[...colliders];
  for(const f of floors)if(f.y>0)physicsColliders.push({name:'deck surface',min:{x:f.minX,y:f.y-.18,z:f.minZ},max:{x:f.maxX,y:f.y,z:f.maxZ}});
  for(const r of ramps)physicsColliders.push({name:'ramp surface',type:'ramp',surfaceOnly:true,thickness:.18,axis:r.axis,direction:r.y1>r.y0?1:-1,
    min:{x:r.minX,y:Math.min(r.y0,r.y1),z:r.minZ},max:{x:r.maxX,y:Math.max(r.y0,r.y1),z:r.maxZ}});
  const bombsites={};for(const[k,v]of Object.entries({A,B}))bombsites[k]={center:v.clone(),radius:4,box:new THREE.Box3(new THREE.Vector3(v.x-4,v.y-1,v.z-4),new THREE.Vector3(v.x+4,v.y+3,v.z+4))};
  return{group,lights,colliders,physicsColliders,floors,ramps,getHeight,stepHeight:STEP,spawnPoints,bombsites,navGrid,
    bounds:{minX:-32,maxX:32,minZ:-32,maxZ:32},sky:{background:0xb4dcf0,fog:{color:0xb4dcf0,near:75,far:190}},
    dispose(){for(const g of geos)g.dispose();for(const m of mats)m.dispose();for(const t of textures)t.dispose();sun.shadow.map?.dispose();}};
}
export default buildMap;
