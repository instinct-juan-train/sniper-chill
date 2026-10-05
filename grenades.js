/** Purchased cartoon grenades. Requires THREE and game's hitscan.raycast.
 * createGrenades(THREE,{scene,map,colliders,raycast,destruction,economy?,getTargets?,
 * onDamage(target,amount,meta),onFlash(target,seconds,meta),onEvent,authority:true})
 * throwGrenade(type,{position,direction,speed,owner,team,consume:true}), update(dt),
 * blocksSight(a,b), flashStrength(eye,forward), getEvents(afterSeq), applyEvent(e),
 * clearRound(), reset(matchId), dispose(). Host adds G/H/J controls or touch buttons.
 * Fixed 1/120 step, swept collisions. Server AUTHORITATIVE detonation events, not
 * floating-point lockstep. Replicas never deal damage or locally decide detonation.
 */
export const GRENADE_ITEMS=Object.freeze({
 frag:{name:'Spicy Pebble',price:300,category:4,desc:'Confetti frag · max 1'},
 smoke:{name:'Pocket Cloud',price:300,category:4,desc:'Smoke for 12 s · max 1'},
 flash:{name:'Disco Blink',price:200,category:4,desc:'Cartoon flash · max 2'}
});
export const GRENADE_CONFIG=Object.freeze({frag:{fuse:1.6,radius:6,damage:140},smoke:{fuse:1.8,radius:4.2,duration:12},flash:{fuse:1.25,radius:14,duration:2.5}});
const v=p=>({x:p.x,y:p.y,z:p.z}),valid=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k])),copy=o=>JSON.parse(JSON.stringify(o));
export function createGrenades(THREE,o={}){
 if(!o.scene||typeof o.raycast!=='function')throw new TypeError('scene and raycast required');
 let disposed=false,seq=0,serial=0,epoch=String(o.matchId??'match-1'),accum=0;
 const authority=o.authority!==false,active=[],clouds=[],flashes=[],events=[],bursts=[];
 const group=new THREE.Group();group.name='cartoon grenade effects';o.scene.add(group);
 const body=new THREE.SphereGeometry(.13,10,7),cap=new THREE.BoxGeometry(.08,.07,.08),puff=new THREE.IcosahedronGeometry(1,1);
 const mats={frag:new THREE.MeshLambertMaterial({color:0xffb094}),smoke:new THREE.MeshLambertMaterial({color:0xb8e9e1}),flash:new THREE.MeshLambertMaterial({color:0xffe6a6})};
 const grey=new THREE.MeshLambertMaterial({color:0x6e8192});
 const cloudMat=new THREE.MeshBasicMaterial({color:0xd5e2df,transparent:true,opacity:.36,depthWrite:false});
 const burstMat=new THREE.MeshBasicMaterial({color:0xffd7a8,transparent:true,opacity:.6,depthWrite:false});
 function publish(e){events.push(copy(e));o.onEvent?.(copy(e));return copy(e);}
 function mesh(type){const g=new THREE.Group(),m=new THREE.Mesh(body,mats[type]),c=new THREE.Mesh(cap,grey);g.add(m,c);c.position.y=.16;group.add(g);return g;}
 function spawn(e){const m=mesh(e.grenade);m.position.set(e.position.x,e.position.y,e.position.z);active.push({id:e.id,type:e.grenade,owner:e.owner,team:e.team,m,p:new THREE.Vector3(e.position.x,e.position.y,e.position.z),vel:new THREE.Vector3(e.velocity.x,e.velocity.y,e.velocity.z),age:0,resting:false});}
 function throwGrenade(type,{position,direction,speed=12,owner='player',team='T',consume=true}={}){
  if(disposed||!authority||!GRENADE_CONFIG[type]||!valid(position)||!valid(direction)||!Number.isFinite(speed)||speed<=0)return false;
  const length=Math.hypot(direction.x,direction.y,direction.z);if(length<1e-8)return false;
  if(consume&&(!o.economy||!o.economy.consumeGrenade(type)))return false;
  const e={version:1,type:'throw',epoch,seq:++seq,id:`${epoch}-g${++serial}`,grenade:type,owner:String(owner),team:String(team),position:v(position),velocity:{x:direction.x/length*speed,y:direction.y/length*speed+2.2,z:direction.z/length*speed}};
  spawn(e);return publish(e);
 }
 const sight=(a,b)=>{const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},distance=Math.hypot(d.x,d.y,d.z);return distance<.2||!o.raycast(a,d,{colliders:o.colliders||[],maxDistance:distance-.15});};
 function effect(e){const cfg=GRENADE_CONFIG[e.grenade],p=e.position;
  if(e.grenade==='smoke'){
   const g=new THREE.Group();g.position.set(p.x,p.y+.8,p.z);group.add(g);const material=cloudMat.clone();
   // Puffs are bounded cosmetics. Occlusion uses a single stable sphere.
   for(let i=0;i<18;i++){const m=new THREE.Mesh(puff,material),a=i*2.399963,r=.8+(i%4)*.55;m.position.set(Math.cos(a)*r,(i%3)*.9,Math.sin(a)*r);m.scale.setScalar(1.15+(i%4)*.15);g.add(m);}
   clouds.push({position:{x:p.x,y:p.y+1.5,z:p.z},radius:cfg.radius,left:cfg.duration,g,material});
  }else if(e.grenade==='flash'){flashes.push({position:v(p),left:.28,radius:cfg.radius});const m=new THREE.Mesh(puff,burstMat);m.position.set(p.x,p.y,p.z);group.add(m);bursts.push({m,left:.4,max:.4});}
  else {const m=new THREE.Mesh(puff,burstMat);m.position.set(p.x,p.y,p.z);group.add(m);bursts.push({m,left:.5,max:.5});}
  if(!authority)return;
  const targets=o.getTargets?.()||[];
  // Calculate shelter BEFORE geometry is destroyed, so blast damage stays coherent.
  for(const target of targets){if(target.alive===false||target.health<=0)continue;const q=target.eye||{x:target.position.x,y:target.position.y+(target.height??1.8)*.6,z:target.position.z};const dist=Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z);if(dist>cfg.radius)continue;
   if(e.grenade==='frag'){const sheltered=!sight(p,q);o.onDamage?.(target,Math.round(cfg.damage*(1-dist/cfg.radius)*(sheltered?.25:1)),{source:'frag',owner:e.owner,team:e.team,position:v(p)});}
   if(e.grenade==='flash'&&sight(p,q)){
    const facing=target.forward?Math.max(0,(target.forward.x*(p.x-q.x)+target.forward.y*(p.y-q.y)+target.forward.z*(p.z-q.z))/Math.max(.01,dist)):1;
    o.onFlash?.(target,cfg.duration*(1-dist/cfg.radius)*(.2+.8*facing),{owner:e.owner,position:v(p)});
   }
  }
  if(e.grenade==='frag')o.destruction?.damage(p,cfg.radius,cfg.damage,{source:'frag'});
 }
 function detonate(g){const e={version:1,type:'detonate',epoch,seq:++seq,id:g.id,grenade:g.type,owner:g.owner,team:g.team,position:v(g.p)};effect(e);publish(e);}
 function step(){const dt=1/120;
  for(let i=active.length-1;i>=0;i--){const g=active[i];g.age+=dt;
   if(!g.resting){g.vel.y-=18*dt;const move=g.vel.clone().multiplyScalar(dt),dist=move.length();
    const hit=dist>1e-9?o.raycast(v(g.p),v(move),{colliders:o.colliders||[],maxDistance:dist+.13}):null;
    if(hit){const n=new THREE.Vector3(hit.normal.x,hit.normal.y,hit.normal.z);if(n.lengthSq()<.1)n.copy(move).normalize().negate();g.p.set(hit.point.x,hit.point.y,hit.point.z).addScaledVector(n,.135);g.vel.addScaledVector(n,-1.48*g.vel.dot(n)).multiplyScalar(.72);if(n.y>.6&&g.vel.length()<1.2){g.vel.set(0,0,0);g.resting=true;}}
    else g.p.add(move);
    if(g.p.y<.13){g.p.y=.13;g.vel.y=Math.abs(g.vel.y)*.3;g.vel.x*=.7;g.vel.z*=.7;if(g.vel.length()<1.2){g.vel.set(0,0,0);g.resting=true;}}
   }
   g.m.position.copy(g.p);g.m.rotation.x+=dt*g.vel.length();g.m.rotation.z+=dt*2;
   if(authority&&g.age>=GRENADE_CONFIG[g.type].fuse){detonate(g);g.m.removeFromParent();active.splice(i,1);}
  }
 }
 function update(dt){if(disposed||!Number.isFinite(dt)||dt<=0)return;accum+=Math.min(dt,.25);while(accum>=1/120){step();accum-=1/120;}
  for(let i=clouds.length-1;i>=0;i--){const c=clouds[i];c.left-=dt;c.material.opacity=.36*Math.min(1,c.left/2);c.g.scale.setScalar(Math.min(1,(GRENADE_CONFIG.smoke.duration-c.left)*2));if(c.left<=0){c.g.removeFromParent();c.material.dispose();clouds.splice(i,1);}}
  for(let i=flashes.length-1;i>=0;i--){flashes[i].left-=dt;if(flashes[i].left<=0)flashes.splice(i,1);}
  for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];b.left-=dt;b.m.scale.setScalar(.2+(1-b.left/b.max)*3);if(b.left<=0){b.m.removeFromParent();bursts.splice(i,1);}}
 }
 function clear(){active.forEach(g=>g.m.removeFromParent());clouds.forEach(c=>{c.g.removeFromParent();c.material.dispose();});bursts.forEach(b=>b.m.removeFromParent());active.length=clouds.length=flashes.length=bursts.length=0;accum=0;}
 function clearRound(){if(disposed)return false;clear();if(authority)publish({version:1,type:'clear',epoch,seq:++seq});return true;}
 function applyEvent(e){if(disposed||authority||e?.version!==1||e.epoch!==epoch||e.seq!==seq+1)return false;
  if(e.type==='throw'){if(!GRENADE_CONFIG[e.grenade]||!valid(e.position)||!valid(e.velocity)||typeof e.id!=='string')return false;spawn(e);}
  else if(e.type==='detonate'){if(!GRENADE_CONFIG[e.grenade]||!valid(e.position))return false;const i=active.findIndex(g=>g.id===e.id);if(i>=0){active[i].m.removeFromParent();active.splice(i,1);}effect(e);}
  else if(e.type==='clear')clear();else if(e.type==='reset'&&typeof e.nextEpoch==='string'){clear();epoch=e.nextEpoch;}else return false;seq=e.seq;events.push(copy(e));return true;
 }
 function blocksSight(a,b){if(!valid(a)||!valid(b))return false;const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,len=dx*dx+dy*dy+dz*dz;return clouds.some(c=>{const p=c.position,t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/len)):0;return Math.hypot(a.x+dx*t-p.x,a.y+dy*t-p.y,a.z+dz*t-p.z)<c.radius;});}
 return {throwGrenade,update,applyEvent,clearRound,blocksSight,group,setEconomy(economy){o.economy=economy;},
  flashStrength(eye,forward){if(!valid(eye))return 0;let s=0;for(const f of flashes){const d=Math.hypot(f.position.x-eye.x,f.position.y-eye.y,f.position.z-eye.z);if(d<f.radius&&sight(eye,f.position)){const facing=valid(forward)?Math.max(0,(forward.x*(f.position.x-eye.x)+forward.y*(f.position.y-eye.y)+forward.z*(f.position.z-eye.z))/Math.max(.01,d)):1;s=Math.max(s,(1-d/f.radius)*(.2+.8*facing));}}return s;},
  reset(matchId){if(!authority||disposed)return false;const e={version:1,type:'reset',epoch,seq:++seq,nextEpoch:String(matchId??epoch+'-next')};clear();publish(e);epoch=e.nextEpoch;return e;},
  getState:()=>({epoch,seq,active:active.map(g=>({id:g.id,type:g.type,position:v(g.p),age:g.age})),clouds:clouds.length}),getEvents:(afterSeq=0)=>copy(events.filter(e=>e.seq>afterSeq)),
  dispose(){if(disposed)return;clear();disposed=true;group.removeFromParent();body.dispose();cap.dispose();puff.dispose();Object.values(mats).forEach(m=>m.dispose());grey.dispose();cloudMat.dispose();burstMat.dispose();}
 };
}
export default createGrenades;
