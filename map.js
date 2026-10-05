/** KITE GARDEN V3 - an original pastel competitive garden-town. Drop-in Three.js r160 map.
 * Coordinates: 64x64m, T south, CT north. Top-surface navigation; decks and stairs have thin physical slabs.
 * Contested market mid, window balcony, orchard alleys and two multi-entry sites.
 * No imports/assets/network requests. All materials/geometries/textures disposed.
 */
export function buildMap(THREE) {
  const group = new THREE.Group(); group.name = 'Kite Garden v3';
  const colliders=[], floors=[], ramps=[], geos=new Set(), mats=new Set(), textures=[];
  const STEP=.32, HALF=32;
  const C={ground:0x91c990, tile:0xe2d2b4, edge:0xb2c4a0, metal:0x6d8494, roof:0xc48576, cream:0xffedce,
    coral:0xff846e, cyan:0x68e3db, purple:0xc8b3cb, green:0x73b787, gold:0xffda8d};
  const cache=new Map();
  function material(color, basic=false) {
    const key=color+':'+basic;
    if(!cache.has(key)){const m=basic?new THREE.MeshBasicMaterial({color}):new THREE.MeshLambertMaterial({color,flatShading:true});cache.set(key,m);mats.add(m);} return cache.get(key);
  }
  function mesh(g,m,x,y,z,solid=false,name='detail') {
    geos.add(g); const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.userData.solid=solid;
    o.name=name;o.userData.structural=solid;o.userData.breakable=false;o.castShadow=solid;o.receiveShadow=true;group.add(o);return o;
  }
  function box(x,z,w,d,h,y,color,name='cover',blocking=true) {
    const o=mesh(new THREE.BoxGeometry(w,h,d),material(color),x,y+h/2,z,true,name);
    if(blocking){const b=new THREE.Box3(new THREE.Vector3(x-w/2,y,z-d/2),new THREE.Vector3(x+w/2,y+h,z+d/2));b.name=name;b.structural=true;b.breakable=false;o.userData.collider=b;colliders.push(b);}return o;
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
    const o=box(x,z,w,d,h,y,color,'planter / cover');o.userData.structural=false;o.userData.breakable=true; o.userData.collider.structural=false;o.userData.collider.breakable=true;detail(x,y+h-.12,z,w+.04,.12,d+.04,C.metal);
    // Small sculptural plants keep silhouettes clear above chest-height cover.
    for(let i=0;i<3;i++)mesh(new THREE.BufferGeometry().copy(new THREE.ConeGeometry(.38,.55,5)),material(C.green),x+(i-1)*w*.22,y+h+.2,z,false,'plant');
  }
  // Parametric layout specification. Structural occlusion must survive destruction.
  // Dimensions in metres. X west/east, Z north/south. All houses are sealed solids.
  const layout = {
    name: 'Kite Garden', version: 3,
    masses: [
      ['T spawn shield',0,20,22,4,7,'cream'],
      ['CT spawn shield',0,-22,24,4,7,'cream'],
      ['central market',0,-4,14,20,8,'cream'],
      ['south bakery',-14,13,8,8,5.4,'coral'],
      ['south pottery',14,13,8,8,5.4,'cyan'],
      ['A orchard elbow',-29,18,5,2,5,'coral'],
      ['B garden elbow',27,16,9,2,5,'cyan'],
      ['bell house',-14,-17,8,6,6,'coral'],
      ['tea house',14,-17,8,6,6,'cyan'],
      ['A connector screen',-14,-2,2,7,5,'coral'],
      ['B connector screen',14,-2,2,7,5,'cyan'],
      ['west orchard wall',-30,4,2,12,6,'cream'],
      ['east greenhouse',30,-7,2,16,6,'cyan']
    ],
    sites:{A:{x:-22,y:0,z:-8},B:{x:22,y:2,z:-8}},
    callouts:[['T GARDEN',0,28],['CT COURT',0,-28],['MID MARKET',0,10],
      ['ORCHARD',-23,20],['GARDEN',23,20],['A CHIME',-22,-8],['B BLOOM',22,-8],
      ['WEST CONNECTOR',-10,-5],['EAST CONNECTOR',10,-5],['TOWER',-25,5],['REAR ROTATE',0,-18]],
    reusable: true
  };
  platform(0,0,64,64,0,C.ground);group.children[0].name='ground';
  for(const [x,z,w,d]of[[0,-32.5,66,1],[0,32.5,66,1],[-32.5,0,1,64],[32.5,0,1,64]])box(x,z,w,d,6,0,C.cream,'perimeter');
  const path=(x,z,w,d)=>detail(x,.03,z,w,.045,d,0xe8d8b5);
  // Plazas, flanks, mid and short defender rotate are readable paving, not maze clutter.
  for(const q of [[0,28,58,7],[0,-28,58,7],[-24,0,10,52],[24,0,10,52],
    [0,13,18,8],[-10,-3,5,31],[10,-3,5,31],[0,-18,23,4],[-22,-8,15,18],[22,-8,15,18]])path(...q);
  function house(x,z,w,d,h,color,name){
    const o=box(x,z,w,d,h,0,color,name);
    box(x,z,w+.3,d+.3,.24,h,C.roof,name+' roof',false);
    const r=new THREE.Box3(new THREE.Vector3(x-w/2-.15,h,z-d/2-.15),new THREE.Vector3(x+w/2+.15,h+.24,z+d/2+.15));
    r.name=name+' roof';r.structural=true;r.breakable=false;colliders.push(r);
    detail(x,.18,z+d/2+.025,w,.3,.045,C.edge);
    detail(x,h-.45,z+d/2+.03,w,.12,.055,C.cream);
    // Painted shutter windows remain flat: no accidental firing gaps or ledges.
    const n=Math.max(1,Math.floor(w/3.8));
    for(let i=0;i<n;i++){
      const xx=x+(i-(n-1)/2)*3.2;
      detail(xx,2.6,z+d/2+.04,1.25,1.5,.07,C.metal);
      detail(xx,2.6,z+d/2+.085,.055,1.52,.025,C.cream);
      detail(xx,2.6,z-d/2-.04,1.25,1.5,.07,C.metal);
    }
    return o;
  }
  for(const[name,x,z,w,d,h,col]of layout.masses)house(x,z,w,d,h,C[col],name);
  const A=new THREE.Vector3(-22,0,-8),B=new THREE.Vector3(22,2,-8);
  platform(22,-8,12,14,2,C.tile);
  ramp(22,3,4,8,'z',2,0);ramp(22,-19,4,8,'z',0,2);
  // Three distinct approaches to each site: outer lane, mid connector, defender rear.
  // B west lip prevents an unphysical sideways step up onto a 2m terrace.
  box(16.15,-8,.3,14,2,0,C.cyan,'B terrace retaining wall');
  ramp(13,-10,6,4,'x',0,2);
  // Protected orchard tower: one narrow lane view, not a cross-map sniper perch.
  platform(-25,5,6,6,3.2,C.tile);
  box(-28.1,5,.3,6,4.1,0,C.coral,'tower west wall');
  box(-25,2,6,.3,.8,3.2,C.coral,'tower north parapet');
  // Split south parapet for stair entrance.
  box(-27.4,8,1.2,.3,1.15,3.2,C.coral,'tower stair left');
  box(-22.6,8,1.2,.3,1.15,3.2,C.coral,'tower stair right');
  // Real 20cm treads and thin per-step colliders, wall-side ascent to the tower.
  // getHeight uses each tread, not a hidden slope. Physics and visuals agree.
  const stairs=[];
  for(let i=0;i<16;i++){
    const y=(16-i)*.2,z=8.25+i*.5;
    platform(-25,z,3.4,.5,y,C.purple);
    stairs.push({x:-25,z,width:3.4,depth:.5,y});
    detail(-25,y+.015,z-.23,3.4,.026,.04,C.cyan);
  }
  box(-27.1,12, .3,8,3.2,0,C.coral,'stair wall');
  // East tower edge is a solid view screen. A narrow north-facing embrasure remains.
  box(-21.9,5,.3,6,2,3.2,C.coral,'tower view screen');
  label('TOWER',-28.25,4.7,5,C.cream,3,Math.PI/2);
  function site(v,color,letter){
    mesh(new THREE.CylinderGeometry(4,4,.06,32),material(color),v.x,v.y+.04,v.z,false,'site '+letter);
    const ring=mesh(new THREE.TorusGeometry(3.7,.05,4,48),material(C.cream,true),v.x,v.y+.085,v.z);ring.rotation.x=Math.PI/2;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#344359';ctx.font='bold 175px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(letter,128,135);
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);
    const m=new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false});mats.add(m);
    const l=mesh(new THREE.PlaneGeometry(2.8,2.8),m,v.x,v.y+.085,v.z);l.rotation.x=-Math.PI/2;
  }
  site(A,C.coral,'A');site(B,C.cyan,'B');
  // Cover deliberately offset from default plant positions and 4m-wide routes.
  cover(-25,-10,2.5,1.6,1.2);cover(-19,-6,2.2,1.6,1.2);
  cover(25,-10,2.5,1.6,1.2,2);cover(19,-6,2.2,1.6,1.2,2);
  cover(-22,24,2.4,1.5,1.15);cover(22,24,2.4,1.5,1.15);
  cover(-9,9,1.5,2,1.15);cover(9,9,1.5,2,1.15);
  box(-28,-14,3,3,7,0,C.coral,'bell tower');
  mesh(new THREE.BufferGeometry().copy(new THREE.ConeGeometry(2.2,1.5,4)),material(C.roof),-28,7.75,-14,false,'bell roof');
  mesh(new THREE.SphereGeometry(.65,8,6),material(C.gold),-28,5.8,-12.45,false,'bell');
  label('A / CHIME',-26.45,3.8,-14,C.cream,4,Math.PI/2);
  label('B / BLOOM',28.9,4.2,-8,C.cream,4,-Math.PI/2);
  label('MID / MARKET',0,5.6,6.04,C.gold,5);
  label('A ←   → B',0,2.8,22.13,C.gold,5);
  label('A ←   → B',0,2.8,-24.13,C.gold,5,Math.PI);
  label('CHIME ←',-14,2.8,17.05,C.cream,3.7);
  label('→ BLOOM',14,2.8,17.05,C.cream,3.7);
  // Decorative awnings and banners only above head height, never opaque false cover.
  for(const[x,z,col]of[[-14,17.2,C.gold],[14,17.2,C.purple],[0,6.2,C.coral]]){
    const o=detail(x,4.5,z,5,.15,1.1,col);o.rotation.x=.12;
    for(let i=0;i<5;i++)detail(x-2+i,4.38,z+.5,.85,.2,.12,i%2?C.cream:col);
  }
  // Round toy trees with short, opaque trunks. Their crowns are non-solid decor.
  for(const[x,z]of[[-30,26],[30,26],[-30,-26],[30,-26],[-10,26],[10,26],[-22,-29],[21,-29]]){
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
      const pass=(c,r,i)=>{
        if(!this.isWalkable(c,r))return false;
        const x=originX+c+.5,z=originZ+r+.5,px=originX+i%64+.5,pz=originZ+Math.floor(i/64)+.5;
        const onStair=(xx,zz)=>xx>=-26.7&&xx<=-23.3&&zz>=8&&zz<=16;
        // Stair rise is .2m every .5m; a 1m nav edge crosses two real steps.
        const rise=onStair(x,z)&&onStair(px,pz)?.41:STEP;
        return Math.abs(height[r*64+c]-height[i])<=rise;
      };
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
  return{layout,stairs,callouts:layout.callouts.map(([name,x,z])=>({name,position:new THREE.Vector3(x,getHeight(x,z),z)})),group,lights,colliders,physicsColliders,floors,ramps,getHeight,stepHeight:STEP,spawnPoints,bombsites,navGrid,
    bounds:{minX:-32,maxX:32,minZ:-32,maxZ:32},sky:{background:0xb4dcf0,fog:{color:0xb4dcf0,near:75,far:190}},
    dispose(){for(const g of geos)g.dispose();for(const m of mats)m.dispose();for(const t of textures)t.dispose();sun.shadow.map?.dispose();}};
}
export default buildMap;
