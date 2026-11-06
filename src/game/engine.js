import { createWorld, zoneAt, ZONES, BOSSES } from './world.js';
import { computeStats, SKILL_BY_ID, CORE_SKILLS, canLearn } from './skills.js';
import { clamp, approach, overlaps, distance, random, xpForLevel, moveAndCollide } from './math.js';
import { Renderer } from './renderer.js';
import { readStored, writeStored } from './storage.js';

export const SAVE_KEY = 'gear-lands-save-v1';
const DEFAULT_SETTINGS = { music: .42, sfx: .65, sound: false, reducedMotion: false, shake: true };
export { DEFAULT_SETTINGS };

export class Game {
  constructor(canvas, settings = {}) {
    this.canvas = canvas; this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.onEvent = () => {}; this.onSound = () => {};
    this.keys = new Set(); this.touchKeys = new Set();
    this.renderer = new Renderer(canvas, this);
    this.reset(false);
    this.load();
    this.lastFrame = 0; this.uiTimer = 0; this.running = true;
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }
  reset(emit = true) {
    this.world = createWorld();
    this.world.decorations.forEach((d,i)=>d.id=i);
    this.world.enemies.forEach(e=>e.maxHp=e.hp);
    this.player = { x:460,y:598,w:30,h:62,vx:0,vy:0,facing:1,grounded:true,hp:5,energy:60,invuln:0,attackTimer:0,attackCooldown:0,dashTimer:0,dashCooldown:0,boltCooldown:0,healing:0,jumps:0,coyote:.1,jumpBuffer:0,wallSide:0,wallLock:0,flightFuel:1,slam:false,lastSafe:{x:460,y:598},dashHit:new Set() };
    this.level=1;this.xp=0;this.points=1;this.gears=0;this.upgrades={hp:0,damage:0,energy:0};this.learned=[];this.defeated=[];this.discovered=[0];this.collectedMemories=[];this.collectedCogs=[];
    this.checkpoint={x:460,y:598,zone:0,id:'scrap-pile'};this.world.benches[0].discovered=false;this.restCount=0;this.awakening=0;
    this.stats=computeStats(this.learned,this.upgrades);
    this.camera={x:0,y:0};this.zone=ZONES[0];this.started=false;this.paused=false;this.dead=false;this.victory=false;
    this.elapsed=0;this.playtime=0;this.kills=0;this.deaths=0;this.resting=0;this.combatTimer=0;this.activeBoss=null;
    this.particles=[];this.projectiles=[];this.effects=[];this.afterimages=[];this.afterTimer=0;this.saveTimer=0;this.deadTimer=0;this.victoryTimer=0;
    this.keys.clear();this.touchKeys.clear();
    if(emit){this.emit('reset');this.emit('hud');this.save();}
  }
  emit(type,data={}){this.onEvent(type,data);}
  sound(name,volume=1,pan=0,pitch=1){this.onSound(name,volume,pan,pitch);}
  frame(timestamp){
    if(!this.running)return;
    const dt=Math.min((timestamp-this.lastFrame)/1000||.016,.04);this.lastFrame=timestamp;
    if(this.started&&!this.paused){
      if(!this.dead){this.update(dt);this.playtime+=dt;}
      else{this.deadTimer+=dt;this.updateParticles(dt);}
    }else if(!this.started){this.elapsed+=dt;this.updateParticles(dt);}
    this.renderer.render(dt);
    this.uiTimer+=dt;if(this.uiTimer>.09){this.uiTimer=0;this.emit('hud');}
    requestAnimationFrame(this.frame);
  }
  start(){this.started=true;this.player.invuln=1.4;this.awakening=2.2;this.burst(this.player.x+15,this.player.y+52,26,'#a89468',150);this.sound('break',.45,0,.65);this.emit('started');this.save();this.canvas.focus({preventScroll:true});}
  setPaused(value){this.paused=value;if(value){this.keys.clear();this.touchKeys.clear();this.player.jumpBuffer=0;}}
  down(code){return this.keys.has(code)||this.touchKeys.has(code);}
  press(code){
    if(!this.started){this.emit('requestStart');return;}
    if(this.paused||this.dead)return;
    this.keys.add(code);
    if(['Space','ArrowUp','KeyW'].includes(code))this.action('jump');
    if(code==='KeyJ')this.action('attack');
    if(code==='KeyK'||code==='ShiftLeft')this.action('dash');
    if(code==='KeyL')this.action('bolt');
    if(code==='KeyF')this.action('heal');
    if(code==='KeyE')this.action('interact');
    if(['KeyS','ArrowDown'].includes(code)&&this.stats.slam&&!this.player.grounded)this.action('slam');
  }
  release(code){this.keys.delete(code);if(['Space','ArrowUp','KeyW'].includes(code)&&!this.down(code)&&this.player.vy<-260)this.player.vy*=.58;}
  action(name){
    if(!this.started){this.emit('requestStart');return;}
    if(this.paused||this.dead)return;
    const p=this.player,s=this.stats;
    if(name==='jump')p.jumpBuffer=.14;
    if(name==='attack'&&p.attackCooldown<=0&&p.dashTimer<=0){
      p.healing=0;p.attackTimer=.32;p.attackCooldown=s.attackCooldown;
      const critical=Math.random()<s.crit;
      const reach=s.range,box={x:p.facing>0?p.x+p.w-6:p.x-reach+6,y:p.y-10,w:reach,h:p.h+18};
      let hit=false;
      for(const e of this.world.enemies)if(!e.dead&&overlaps(box,e)){this.damageEnemy(e,s.damage*(critical?1.8:1),critical);hit=true;}
      for(const b of this.world.bosses)if(!b.dead&&overlaps(box,b)){this.damageEnemy(b,s.damage*(critical?1.8:1),critical);hit=true;}
      this.effects.push({type:'slash',x:p.x+p.w/2+p.facing*18,y:p.y+27,dir:p.facing,radius:reach-12,life:.22,maxLife:.22,color:critical?'#f3d496':'#e2e6c7'});
      this.sound('sword',.65,0,critical?1.12:1);
      if(s.slashWave)this.shoot(p.x+p.w/2+p.facing*25,p.y+27,p.facing*560,0,s.damage*.65,'player','slash',9,1.0);
      if(hit){this.player.energy=Math.min(s.energy,p.energy+4+s.energyOnHit);this.renderer.kick(critical?5:2.5);}
    }
    if(name==='dash'){
      if(!s.dash){this.emit('toast',{title:'Привод ещё не пробуждён',text:'Изучи «Паровой поршень» или победи первого хранителя.',icon:'lock-keyhole'});return;}
      if(p.dashCooldown>0||p.energy<8)return;
      p.energy-=8;p.dashTimer=.18;p.dashCooldown=s.dashCooldown;p.invuln=Math.max(p.invuln,.23);p.vx=p.facing*880;p.vy=0;p.healing=0;p.dashHit=new Set();this.sound('dash',.6);this.burst(p.x+15,p.y+40,12,'#b4cfb0',100,'smoke');
    }
    if(name==='bolt'){
      if(!s.bolt){this.emit('toast',{title:'Нужен паровой заряд',text:'Изучи навык в ветви «Механизмы».',icon:'lock-keyhole'});return;}
      if(p.boltCooldown>0||p.energy<12)return;
      p.energy-=12;p.boltCooldown=s.boltCooldown;p.healing=0;
      this.shoot(p.x+15+p.facing*24,p.y+28,p.facing*680,0,24+s.boltDamage,'player','bolt',7,1.5);this.sound('steam',.6,0,1.2);this.burst(p.x+15+p.facing*25,p.y+28,7,'#c3e0bf',90);
    }
    if(name==='heal'){
      if(p.healing>0||p.dashTimer>0)return;
      if(p.hp>=this.stats.hp){this.emit('toast',{title:'Корпус цел',text:'Все ячейки здоровья восстановлены.',icon:'shield'});return;}
      if(p.energy<s.healCost){this.emit('toast',{title:'Недостаточно пара',text:`Для починки нужно ${s.healCost} пара. Попадай по врагам, чтобы восстановить энергию.`,icon:'zap'});return;}
      p.energy-=s.healCost;p.healing=.85;p.attackTimer=0;this.sound('heal',.55);
    }
    if(name==='slam'&&s.slam&&!p.grounded&&p.energy>=18&&!p.slam){p.energy-=18;p.slam=true;p.vy=1150;p.vx*=.3;p.dashTimer=0;this.sound('sword',.6,0,.7);}
    if(name==='interact')this.interact();
  }
  update(dt){
    this.elapsed+=dt;this.awakening=Math.max(0,this.awakening-dt);this.resting=Math.max(0,this.resting-dt);this.combatTimer=Math.max(0,this.combatTimer-dt);this.saveTimer+=dt;
    if(this.saveTimer>25){this.saveTimer=0;this.save();}
    const p=this.player,s=this.stats;
    for(const key of ['invuln','attackTimer','attackCooldown','dashCooldown','boltCooldown','wallLock'])p[key]=Math.max(0,p[key]-dt);
    p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);p.coyote=p.grounded?.11:Math.max(0,p.coyote-dt);
    if(p.grounded){p.jumps=0;p.flightFuel=1;}else if(p.coyote<=0&&p.jumps===0)p.jumps=1;
    const axis=(this.down('KeyD')||this.down('ArrowRight')||this.down('right')?1:0)-(this.down('KeyA')||this.down('ArrowLeft')||this.down('left')?1:0);
    if(axis&&p.dashTimer<=0&&p.wallLock<=0)p.facing=axis;
    p.wallSide=0;
    if(s.wallJump&&!p.grounded){for(const w of this.world.walls){if(p.y+p.h>w.y&&p.y<w.y+w.h){if(Math.abs(p.x+p.w-w.x)<7)p.wallSide=1;else if(Math.abs(p.x-(w.x+w.w))<7)p.wallSide=-1;}}}
    if(p.jumpBuffer>0){
      if(p.grounded||p.coyote>0){this.jump(-680);p.jumps=1;}
      else if(p.wallSide&&s.wallJump){this.jump(-690);p.vx=-p.wallSide*420;p.facing=-p.wallSide;p.wallLock=.18;p.jumps=1;this.burst(p.x+15,p.y+40,8,'#c9bd88',120);}
      else if(p.jumps<s.maxJumps){this.jump(-650);p.jumps++;this.burst(p.x+15,p.y+60,14,p.jumps===3?'#c4e6c7':'#d5c8a1',130,'smoke');this.effects.push({type:'ring',x:p.x+15,y:p.y+62,radius:35,life:.35,maxLife:.35,color:'#d7d4ae'});}
    }
    if(p.dashTimer>0){
      p.dashTimer-=dt;p.vx=p.facing*880;p.vy=0;this.afterTimer-=dt;
      if(this.afterTimer<=0){this.afterimages.push({x:p.x,y:p.y,facing:p.facing,life:.22});this.afterTimer=.035;}
      if(s.dashDamage){for(const e of [...this.world.enemies,...this.world.bosses])if(!e.dead&&!p.dashHit.has(e.id)&&overlaps(p,e)){p.dashHit.add(e.id);this.damageEnemy(e,s.dashDamage);}}
    }else{
      if(p.wallLock<=0){const speed=300*(p.healing>0?.28:1);const accel=(p.grounded?2300:1350*(1+s.airControl))*dt;p.vx=approach(p.vx,axis*speed,accel);}
      p.vy=Math.min(1050,p.vy+1800*dt);
      if(p.wallSide&&axis===p.wallSide&&p.vy>0){p.vy=Math.min(p.vy,105);if(Math.random()<.2)this.burst(p.x+(p.wallSide>0?p.w:0),p.y+40,1,'#d9bd80',50);}
      if(s.flight&&this.down('Space')&&p.jumps>=s.maxJumps&&p.vy>30&&p.flightFuel>0){p.vy=Math.min(p.vy,45);p.flightFuel-=dt*.55;if(Math.random()<.4)this.burst(p.x+15,p.y+60,1,'#b6dfc0',35,'smoke');}
    }
    if(p.healing>0){p.healing-=dt;if(p.healing<=0){p.hp=Math.min(s.hp,p.hp+s.healAmount);this.burst(p.x+15,p.y+30,24,'#d4e6b9',100);this.effects.push({type:'ring',x:p.x+15,y:p.y+40,radius:80,life:.65,maxLife:.65,color:'#d0e3b2'});this.emit('hud');}}
    p.energy=Math.min(s.energy,p.energy+s.energyRegen*dt*(p.dashTimer>0?0:1));
    const wasGrounded=p.grounded,oldVy=p.vy;
    const nearby=this.world.platforms.filter(q=>q.x<p.x+1000&&q.x+q.w>p.x-500);
    const walls=[...this.world.walls,...this.world.gates.filter(g=>!this.defeated.includes(g.requirement)),...this.world.bosses.filter(b=>b.active&&!b.dead&&b.arenaMin).map(b=>({x:b.arenaMin-60,y:ZONES[b.zone].floor-460,w:20,h:660,type:'arena'}))];
    moveAndCollide(p,nearby,dt,walls);
    p.x=clamp(p.x,8,19460-p.w);
    if(p.grounded&&!wasGrounded){
      if(oldVy>350){this.sound('land',Math.min(.6,oldVy/1400));this.burst(p.x+15,p.y+62,8,'#a5aa83',80,'smoke');}
      if(p.slam){p.slam=false;this.renderer.kick(9);this.sound('hit',.9,0,.65);this.effects.push({type:'ring',x:p.x+15,y:p.y+62,radius:175,life:.55,maxLife:.55,color:'#e2c992'});for(const e of [...this.world.enemies,...this.world.bosses])if(!e.dead&&distance({x:p.x,y:p.y+60},{x:e.x+e.w/2,y:e.y+e.h})<185)this.damageEnemy(e,s.damage*2.2,true);}
      const platform=p.platform;
      if(platform&&p.x>platform.x+22&&p.x+p.w<platform.x+platform.w-22)p.lastSafe={x:p.x,y:p.y};
    }
    if(p.y>this.zone.floor+260){this.hurt(1,true);if(!this.dead){p.x=p.lastSafe.x;p.y=p.lastSafe.y-10;p.vx=0;p.vy=0;p.invuln=1.4;}}
    if(p.grounded&&Math.abs(p.vx)>100&&Math.random()<dt*9){this.sound('step',.18);this.burst(p.x+15,p.y+62,1,'#a4ab8066',30,'smoke');}
    for(const h of this.world.hazards)if(h.type==='steam'&&(this.elapsed+h.phase)%4.8>2.8&&overlaps(p,{x:h.x+5,y:h.y-125,w:h.w-10,h:125}))this.hurt(1);
    for(const d of this.world.decorations){if(d.type!=='cog'||d.collected)continue;const dst=Math.hypot(d.x-(p.x+15),d.y-(p.y+30));if(dst<s.pickup){d.x=approach(d.x,p.x+15,dt*360);d.y=approach(d.y,p.y+28,dt*360);if(dst<25){d.collected=true;this.collectedCogs.push(d.id);this.gears+=d.value;this.sound('pickup',.2,0,1.2);this.burst(d.x,d.y,4,'#d7bd7e',50);}}}
    for(const e of this.world.enemies)if(!e.dead&&Math.abs(e.x-p.x)<1050&&Math.abs(e.y-p.y)<650)this.updateEnemy(e,dt,nearby);
    this.activeBoss=null;
    for(const b of this.world.bosses)if(!b.dead){this.updateBoss(b,dt);if(b.active)this.activeBoss=b;}
    this.updateProjectiles(dt);this.updateParticles(dt);
    for(const a of this.afterimages)a.life-=dt;this.afterimages=this.afterimages.filter(a=>a.life>0);
    for(const e of this.effects)e.life-=dt;this.effects=this.effects.filter(e=>e.life>0);
    const newZone=zoneAt(p.x+15);
    if(newZone.id!==this.zone.id){this.zone=newZone;if(!this.discovered.includes(newZone.id)){this.discovered.push(newZone.id);this.emit('zone',newZone);this.gainXp(50);}else this.emit('zoneQuiet',newZone);this.save();}
    if(this.victoryTimer>0){this.victoryTimer-=dt;if(this.victoryTimer<=0)this.emit('victory');}
    const near=this.getInteraction();this.emit('interaction',near);
  }
  jump(vy){const p=this.player;p.vy=vy;p.grounded=false;p.coyote=0;p.jumpBuffer=0;this.sound('jump',.38,0,p.jumps?1.15:1);}
  getInteraction(){const p=this.player;for(const b of this.world.benches)if(Math.abs(p.x+15-b.x)<95&&Math.abs(p.y+p.h-b.y)<70)return{type:'bench',target:b,text:this.resting?'Маяк синхронизирован':'Отдохнуть у маяка'};for(const m of this.world.memories)if(!m.collected&&Math.hypot(p.x+15-m.x,p.y+30-m.y)<85)return{type:'memory',target:m,text:'Прочитать отголосок памяти'};for(const g of this.world.gates)if(!this.defeated.includes(g.requirement)&&Math.abs(p.x-g.x)<100)return{type:'gate',target:g,text:`Победи: ${BOSSES[g.requirement].short}`};return null;}
  interact(){const near=this.getInteraction();if(!near)return;if(near.type==='bench')this.rest(near.target);if(near.type==='memory'){const m=near.target;m.collected=true;this.collectedMemories.push(m.id);this.points++;this.gainXp(65);this.gears+=35;this.sound('unlock',.65);this.burst(m.x,m.y,35,'#cde5bd',150);const lore=['«Если ты это читаешь, значит, искра не погасла. Я оставил тебе не оружие. Я оставил тебе выбор».','«Город строили люди. Потом механизмы научились строить город. Люди стали лишней деталью».','«Мы называли её Мнемозой. Она помнила все имена. Даже то, которое император приказал забыть».','«Приказ № 0: неисправные единицы подлежат утилизации. Подпись: Аврелий. Место: королевская свалка».','«Он поднял трон над облаками, чтобы больше никогда не слышать голосов внизу».',''];this.emit('memory',{title:'Отголосок памяти',text:lore[m.zone],points:1});this.emit('quest');this.save();}}
  rest(bench,travel=false){if(this.activeBoss||this.combatTimer>4){this.emit('toast',{title:'Механизмы ещё тревожатся',text:'Маяк недоступен во время боя. Оторвись от противников.',icon:'shield'});return;}
    this.checkpoint={x:bench.x-35,y:bench.y-62,zone:bench.zone,id:bench.id};bench.discovered=true;this.restCount++;this.player.x=this.checkpoint.x;this.player.y=this.checkpoint.y;this.player.vx=0;this.player.vy=0;this.player.hp=this.stats.hp;this.player.energy=this.stats.energy;this.player.healing=0;this.player.invuln=1.5;this.player.lastSafe={x:this.player.x,y:this.player.y};this.resting=4;this.combatTimer=0;this.projectiles=[];this.respawnEnemies();this.sound('heal',.7);this.burst(bench.x+28,bench.y-105,25,'#e5cf92',90);this.emit('rest',{bench,travel});this.emit('quest');this.save();}
  travel(zoneId){const bench=this.world.benches.find(b=>b.zone===zoneId&&b.discovered);if(!bench)return false;if(this.activeBoss||this.combatTimer>4){this.emit('toast',{title:'Нельзя покинуть бой',text:'Сначала разорви контакт с противником.',icon:'shield'});return false;}this.zone=ZONES[zoneId];this.rest(bench,true);this.camera.x=this.player.x-this.renderer.width*.48;this.camera.y=clamp(this.player.y-this.renderer.height*.61,zoneId===4?-2070:zoneId===5?-2180:-240,zoneId===5?-1770:100);return true;}
  respawnEnemies(){this.world.enemies=this.world.enemies.filter(e=>!e.temporary);for(const e of this.world.enemies){e.dead=false;e.hp=e.maxHp;e.x=e.spawnX;e.y=e.spawnY;e.vx=0;e.vy=0;e.state='patrol';e.attackTimer=1.5;e.timer=0;e.hit=0;}for(const b of this.world.bosses)if(!b.dead){b.active=false;b.hp=b.maxHp;b.x=b.spawnX;b.y=b.spawnY;b.state='idle';b.timer=1.8;b.phase=1;}}
  hurt(amount=1,force=false){const p=this.player;if(this.dead||(!force&&p.invuln>0))return false;const damage=Math.max(.5,amount*(1-this.stats.armor));p.hp=Math.max(0,p.hp-damage);p.invuln=1.15;p.healing=0;this.combatTimer=8;this.sound('hurt',.65);this.renderer.kick(7);this.burst(p.x+15,p.y+28,15,'#cba17b',170);this.emit('damage');if(p.hp<=0){this.dead=true;this.deadTimer=0;this.deaths++;const lost=Math.floor(this.gears*.1);this.gears-=lost;this.player.vx=0;this.activeBoss=null;this.emit('death',{lost});this.save();}return true;}
  respawn(){this.dead=false;this.paused=false;this.player.x=this.checkpoint.x;this.player.y=this.checkpoint.y;this.player.vx=0;this.player.vy=0;this.player.hp=this.stats.hp;this.player.energy=this.stats.energy;this.player.invuln=2;this.player.healing=0;this.player.dashTimer=0;this.player.slam=false;this.player.lastSafe={x:this.player.x,y:this.player.y};this.zone=ZONES[this.checkpoint.zone];this.projectiles=[];this.particles=[];this.effects=[];this.combatTimer=0;this.respawnEnemies();this.camera.x=this.player.x-this.renderer.width*.48;this.camera.y=clamp(this.player.y-this.renderer.height*.61,this.zone.id===4?-2070:this.zone.id===5?-2180:-240,this.zone.id===5?-1770:100);this.emit('respawn');this.emit('hud');this.canvas.focus({preventScroll:true});}
  damageEnemy(e,amount,critical=false){if(e.dead)return;const isBoss=Boolean(e.maxHp&&BOSSES[e.id]);if(isBoss&&e.state==='transition')return;
    if(e.hp/e.maxHp<.3)amount*=1+this.stats.execute;
    amount=Math.round(amount);e.hp-=amount;e.hit=.15;this.combatTimer=8;
    this.sound(isBoss?'hit':'break',isBoss?.6:.36,clamp((e.x-this.player.x)/500,-.7,.7),isBoss?.8:1);
    this.burst(e.x+e.w/2,e.y+e.h*.45,critical?18:9,isBoss?'#e2bf81':'#cbb17b',critical?230:150);
    this.effects.push({type:'text',x:e.x+e.w/2,y:e.y-8,text:String(amount),color:critical?'#f2d49a':'#dddcc0',crit:critical,life:.7,maxLife:.7});
    if(!isBoss){e.x+=this.player.facing*5;if(e.hp<=0)this.killEnemy(e);}else{const threshold=e.phase===1?.65:.32;if(e.hp>0&&e.hp/e.maxHp<threshold&&e.phase<(e.id==='emperor'?3:2)){e.phase++;e.state='transition';e.timer=.9;e.vx=0;this.effects.push({type:'ring',x:e.x+e.w/2,y:e.y+e.h/2,radius:180,life:.8,maxLife:.8,color:e.color});this.sound('boss',.5);this.emit('bossPhase',{boss:e});}if(e.hp<=0)this.killBoss(e);}
  }
  killEnemy(e){e.dead=true;this.kills++;const base=e.type==='sentinel'?22:e.type==='drone'?17:14;const zoneBonus=e.zone*4;this.gainXp(Math.round((base+zoneBonus)*(1+this.stats.xp)));this.gears+=Math.round((base+8+zoneBonus)*(1+this.stats.gears));this.player.energy=Math.min(this.stats.energy,this.player.energy+this.stats.energyOnKill);this.burst(e.x+e.w/2,e.y+e.h/2,20,'#b9a273',210);this.effects.push({type:'ring',x:e.x+e.w/2,y:e.y+e.h/2,radius:45,life:.35,maxLife:.35,color:'#d1ba84'});}
  killBoss(b){b.dead=true;b.active=false;this.activeBoss=null;this.kills++;this.defeated.push(b.id);this.gears+=b.gears;this.points+=b.points;this.gainXp(b.xp);for(const r of b.reward){const id=CORE_SKILLS[r];if(!this.learned.includes(id))this.learned.push(id);}this.refreshStats(true);this.player.hp=this.stats.hp;this.player.energy=this.stats.energy;this.player.invuln=2;this.projectiles=this.projectiles.filter(s=>s.owner==='player');this.world.enemies=this.world.enemies.filter(e=>!e.temporary);
    this.burst(b.x+b.w/2,b.y+b.h/2,75,b.color,330);this.effects.push({type:'ring',x:b.x+b.w/2,y:b.y+b.h/2,radius:270,life:1.3,maxLife:1.3,color:b.color});this.renderer.kick(12);this.sound('unlock',.9);this.emit('bossDefeated',b);this.emit('quest');if(b.id==='emperor'){this.victory=true;this.victoryTimer=2.5;this.projectiles=[];}this.save();}
  gainXp(amount){this.xp+=amount;let leveled=false;while(this.xp>=xpForLevel(this.level)){this.xp-=xpForLevel(this.level);this.level++;this.points++;leveled=true;}if(leveled){this.player.hp=Math.min(this.stats.hp,this.player.hp+1);this.player.energy=this.stats.energy;this.sound('unlock',.55);this.burst(this.player.x+15,this.player.y+25,30,'#d9cf9d',150);this.emit('levelUp',{level:this.level,points:this.points});}this.emit('hud');}
  refreshStats(fill=false){const old=this.stats;this.stats=computeStats(this.learned,this.upgrades);this.player.hp=fill?this.stats.hp:Math.min(this.stats.hp,this.player.hp+Math.max(0,this.stats.hp-old.hp));this.player.energy=fill?this.stats.energy:Math.min(this.stats.energy,this.player.energy+Math.max(0,this.stats.energy-old.energy));this.emit('hud');}
  learn(id){const skill=SKILL_BY_ID[id];if(!skill||!canLearn(skill,this.learned,this.points))return false;this.points-=skill.cost;this.learned.push(id);this.refreshStats();this.sound('unlock',.6);this.emit('skillLearned',skill);this.emit('quest');this.save();return true;}
  upgradeCost(stat){return ({hp:45,damage:55,energy:40}[stat]||999)+this.upgrades[stat]*({hp:30,damage:35,energy:25}[stat]||999);}
  upgrade(stat){if(!(stat in this.upgrades)||this.upgrades[stat]>=10)return false;const cost=this.upgradeCost(stat);if(this.gears<cost)return false;this.gears-=cost;this.upgrades[stat]++;this.refreshStats();this.sound('unlock',.45);this.emit('toast',{title:'Механизм улучшен',text:{hp:'Добавлена ячейка здоровья.',damage:'Урон клинка увеличен на 3.',energy:'Максимум пара увеличен на 10.'}[stat],icon:'wrench'});this.save();return true;}
  updateEnemy(e,dt,nearby){const p=this.player;e.timer+=dt;e.hit=Math.max(0,e.hit-dt);e.attackTimer-=dt;const dx=p.x-e.x,dy=p.y-e.y,dist=Math.hypot(dx,dy);
    if(e.type==='drone'){
      e.y=e.spawnY+Math.sin(this.elapsed*2+e.spawnX)*17;
      if(e.state==='windup'){e.vx*=.9;if(e.attackTimer<=0){const angle=Math.atan2(p.y+28-(e.y+18),p.x+15-(e.x+22));this.shoot(e.x+22,e.y+18,Math.cos(angle)*245,Math.sin(angle)*245,1,'boss','bolt',6,3.5);e.state='patrol';e.attackTimer=2.1;this.sound('steam',.18,0,1.4);}}
      else{if(dist<420){e.dir=dx>0?1:-1;e.x+=e.dir*38*dt;if(e.attackTimer<=0&&dist<600){e.state='windup';e.attackTimer=.5;}}else{e.x+=Math.sin(e.timer)*15*dt;e.dir=Math.cos(e.timer*.5)>0?1:-1;}}
      e.x=clamp(e.x,e.spawnX-e.range,e.spawnX+e.range);
    }else{
      const speed=e.type==='sentinel'?56:83;const range=e.type==='sentinel'?88:65;
      if(e.state==='windup'){e.vx=0;if(e.attackTimer<=0){e.state='lunging';e.timer=0;e.attackTimer=.32;e.vx=e.dir*(e.type==='sentinel'?260:340);this.sound('sword',.22,0,.7);}}
      else if(e.state==='lunging'){if(e.attackTimer<=0){e.state='patrol';e.attackTimer=1.25;e.vx=0;}}
      else{if(Math.abs(dx)<270&&Math.abs(dy)<80)e.dir=dx>0?1:-1;else if(Math.abs(e.x-e.spawnX)>e.range)e.dir=e.x>e.spawnX?-1:1;
        const ahead=e.x+e.w/2+e.dir*32;const ground=this.world.platforms.some(q=>ahead>q.x&&ahead<q.x+q.w&&Math.abs(q.y-(e.y+e.h))<20);if(!ground&&e.grounded)e.dir*=-1;
        e.vx=e.dir*speed;if(Math.abs(dx)<range&&Math.abs(dy)<65&&e.attackTimer<=0){e.state='windup';e.attackTimer=e.type==='sentinel'?.55:.4;e.vx=0;}}
      e.vy=Math.min(900,e.vy+1800*dt);const localPlatforms=this.world.platforms.filter(q=>q.x<e.x+420&&q.x+q.w>e.x-420);moveAndCollide(e,localPlatforms,dt);if(e.y>this.zone.floor+350){e.dead=true;return;}
    }
    if(overlaps({x:p.x+4,y:p.y+4,w:p.w-8,h:p.h-4},e)){const damaged=p.dashTimer<=0?this.hurt(e.type==='sentinel'?1.25:1):false;if(damaged&&this.stats.thorns)this.damageEnemy(e,this.stats.thorns);}
  }
  updateBoss(b,dt){const p=this.player;const dx=p.x+15-(b.x+b.w/2),dy=p.y+p.h-(b.y+b.h);b.hit=Math.max(0,b.hit-dt);
    if(!b.active){if(Math.abs(dx)<650&&Math.abs(dy)<230&&p.x+p.w/2>=(b.arenaMin??-Infinity)&&p.x<=(b.arenaMax??Infinity)){b.active=true;b.timer=1.2;b.state='idle';this.sound('boss',.65);this.emit('bossStarted',b);}return;}
    if(Math.abs(dx)>1200||Math.abs(dy)>650){b.active=false;b.hp=b.maxHp;b.x=b.spawnX;b.y=b.spawnY;b.state='idle';b.phase=1;return;}
    b.timer-=dt;
    if(b.state==='transition'){b.vx=0;if(b.timer<=0){b.state='idle';b.timer=.35;}return;}
    if(b.state==='idle'){b.dir=dx>0?1:-1;b.vx=Math.abs(dx)>170?b.dir*(b.id==='scrap'?55:75):0;if(b.timer<=0){const patterns={scrap:['slam','charge','volley'],clock:['charge','volley','slam','summon'],abbess:['volley','rain','charge','slam'],emperor:['charge','volley','slam','rain','summon']};b.attackKind=patterns[b.id][b.attackIndex++%patterns[b.id].length];b.state='windup';b.timer=(b.id==='emperor'?.65:.8)-(b.phase-1)*.1;b.vx=0;b.dir=dx>0?1:-1;this.sound('steam',.25,0,.7);}}
    else if(b.state==='windup'){b.vx=0;if(b.timer<=0){this.bossAttack(b);b.state='attack';b.timer=b.attackKind==='charge'?.65:.45;}}
    else if(b.state==='attack'){if(b.attackKind!=='charge')b.vx=approach(b.vx,0,dt*1600);if(b.timer<=0){b.state='recover';b.timer=b.id==='emperor'?.6:.95;b.vx=0;}}
    else if(b.state==='recover'){b.vx=0;if(b.timer<=0){b.state='idle';b.timer=.3;}}
    b.x+=b.vx*dt;b.x=clamp(b.x,b.arenaMin ?? ZONES[b.zone].start+120,(b.arenaMax ?? ZONES[b.zone].end-70)-b.w);
    const floor=ZONES[b.zone].floor;b.y=floor-b.h+(b.id==='abbess'?-35+Math.sin(this.elapsed*1.8)*15:0);
    if(overlaps({x:p.x+5,y:p.y+5,w:p.w-10,h:p.h-8},{x:b.x+12,y:b.y+10,w:b.w-24,h:b.h-10})&&p.dashTimer<=0)this.hurt(b.state==='attack'?1.5:1);
    if(b.state==='attack'&&b.attackKind==='charge'&&Math.random()<.4)this.burst(b.x+b.w/2,b.y+b.h,2,b.color+'88',70,'smoke');
  }
  bossAttack(b){const p=this.player;const x=b.x+b.w/2,y=b.y+b.h*.45;const angle=Math.atan2(p.y+30-y,p.x+15-x);const speed=230+b.phase*27;
    if(b.attackKind==='charge'){b.vx=b.dir*(b.id==='emperor'?620:490);this.sound('dash',.65,0,.65);}
    if(b.attackKind==='volley'){const count=b.phase===1?5:b.phase===2?7:9;for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.18;this.shoot(x,y,Math.cos(a)*speed,Math.sin(a)*speed,1,'boss','bolt',8,4,b.color);}this.sound('steam',.55,0,.8);}
    if(b.attackKind==='slam'){const floor=ZONES[b.zone].floor;this.renderer.kick(8);this.sound('hit',.9,0,.55);this.effects.push({type:'ring',x,y:floor,radius:190,life:.65,maxLife:.65,color:b.color});this.burst(x,floor,28,'#c2b184',230);if(Math.abs(p.x+15-x)<155&&Math.abs(p.y+p.h-floor)<65)this.hurt(1.5);for(const dir of [-1,1])this.shoot(x,floor-13,dir*(300+b.phase*30),0,1,'boss','shockwave',16,2.4,b.color);}
    if(b.attackKind==='rain'){const count=5+b.phase;for(let i=0;i<count;i++){const xx=p.x+15+(i-(count-1)/2)*80;this.shoot(xx,p.y-330-i%2*45,0,270+b.phase*20,1,'boss','bolt',9,3.2,b.color);this.effects.push({type:'ring',x:xx,y:ZONES[b.zone].floor,radius:27,life:.9,maxLife:.9,color:'#d5ae78'});}this.sound('boss',.4,0,1.2);}
    if(b.attackKind==='summon'){const alive=this.world.enemies.filter(e=>e.temporary&&!e.dead).length;for(let i=0;i<Math.min(2,4-alive);i++){const xx=b.x+(i?130:-130),yy=b.y+10;this.world.enemies.push({id:`summon-${this.elapsed}-${i}`,x:xx,y:yy,spawnX:xx,spawnY:yy,type:'drone',zone:b.zone,range:260,w:44,h:37,hp:35,maxHp:35,dir:i?1:-1,vx:0,vy:0,timer:0,attackTimer:1.1+i*.4,hit:0,dead:false,temporary:true});this.burst(xx,yy,18,b.color,130);}this.sound('unlock',.35,0,.7);}
  }
  shoot(x,y,vx,vy,damage,owner,kind,r,life,color='#c6dfbd'){this.projectiles.push({x,y,vx,vy,damage,owner,kind,r,life,maxLife:life,color,hit:new Set()});}
  updateProjectiles(dt){const p=this.player;for(const s of this.projectiles){s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;if(Math.random()<.35)this.burst(s.x,s.y,1,s.color+'66',15,'smoke');
      if(s.owner==='player'){
        for(const e of [...this.world.enemies,...this.world.bosses])if(!e.dead&&!s.hit.has(e.id)&&overlaps({x:s.x-s.r,y:s.y-s.r,w:s.r*2,h:s.r*2},e)){this.damageEnemy(e,s.damage);s.hit.add(e.id);if(s.kind!=='slash'){s.life=0;break;}}
      }else{const box={x:s.x-s.r,y:s.y-s.r,w:s.r*2,h:s.r*2};if(p.dashTimer<=0&&overlaps(box,p)){this.hurt(s.damage);s.life=0;}if(s.kind!=='shockwave'&&this.world.platforms.some(q=>s.x>q.x&&s.x<q.x+q.w&&s.y>q.y+4&&s.y<q.y+q.h))s.life=0;}
    }this.projectiles=this.projectiles.filter(s=>s.life>0&&s.x>this.camera.x-800&&s.x<this.camera.x+this.renderer.width+800);}
  burst(x,y,count,color,speed=120,type='spark'){if(this.settings.reducedMotion)count=Math.ceil(count*.35);for(let i=0;i<count;i++){if(this.particles.length>420)this.particles.shift();const a=random(0,Math.PI*2),v=random(speed*.2,speed),life=random(.25,.8);this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(type==='smoke'?30:0),life,maxLife:life,color,type,size:type==='smoke'?random(4,10):random(1,3)});}}
  updateParticles(dt){for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-dt*2);p.vy+=dt*(p.type==='smoke'?-35:350);}this.particles=this.particles.filter(p=>p.life>0);}
  save(){if(!this.started)return;const data={version:1,level:this.level,xp:this.xp,points:this.points,gears:this.gears,upgrades:this.upgrades,learned:this.learned,defeated:this.defeated,discovered:this.discovered,collectedMemories:this.collectedMemories,collectedCogs:this.collectedCogs,discoveredBenches:this.world.benches.filter(b=>b.discovered).map(b=>b.id),restCount:this.restCount,checkpoint:this.checkpoint,hp:this.player.hp,energy:this.player.energy,playtime:this.playtime,kills:this.kills,deaths:this.deaths,victory:this.victory,started:true,savedAt:Date.now()};try{this.emit('saved',{ok:writeStored(SAVE_KEY,JSON.stringify(data))});}catch{this.emit('saved',{ok:false});}}
  load(){try{const raw=readStored(SAVE_KEY);if(!raw)return false;const d=JSON.parse(raw);if(d.version!==1||!Number.isFinite(d.level)||!Array.isArray(d.learned)||!d.checkpoint||!Number.isFinite(d.checkpoint.x)||!Number.isFinite(d.checkpoint.y)||!ZONES[d.checkpoint.zone])return false;
      this.level=clamp(Math.floor(d.level),1,200);this.xp=Math.max(0,Number(d.xp)||0);this.points=Math.max(0,Number(d.points)||0);this.gears=Math.max(0,Number(d.gears)||0);this.upgrades={hp:clamp(Number(d.upgrades?.hp)||0,0,10),damage:clamp(Number(d.upgrades?.damage)||0,0,10),energy:clamp(Number(d.upgrades?.energy)||0,0,10)};
      this.learned=[...new Set(d.learned.filter(id=>SKILL_BY_ID[id]))];this.defeated=[...new Set((d.defeated||[]).filter(id=>BOSSES[id]))];this.discovered=[...new Set([0,...(d.discovered||[]).filter(id=>Number.isInteger(id)&&ZONES[id])])];this.collectedMemories=(d.collectedMemories||[]).filter(id=>this.world.memories.some(m=>m.id===id));this.collectedCogs=(d.collectedCogs||[]).filter(id=>Number.isInteger(id));this.checkpoint={x:clamp(d.checkpoint.x,0,19400),y:clamp(d.checkpoint.y,-2000,700),zone:d.checkpoint.zone,id:d.checkpoint.id};
      this.stats=computeStats(this.learned,this.upgrades);this.player.x=this.checkpoint.x;this.player.y=this.checkpoint.y;const savedHp=Number(d.hp);this.player.hp=Number.isFinite(savedHp)&&savedHp>0?clamp(savedHp,.5,this.stats.hp):this.stats.hp;this.player.energy=clamp(Number(d.energy)||0,0,this.stats.energy);this.player.lastSafe={x:this.player.x,y:this.player.y};this.zone=ZONES[this.checkpoint.zone];this.camera.x=this.player.x-600;this.camera.y=clamp(this.player.y-460,this.zone.id===4?-2070:this.zone.id===5?-2180:-240,this.zone.id===5?-1770:100);
      this.restCount=Math.max(0,Number(d.restCount)||(d.checkpoint.id==='scrap-pile'?0:1));
      const benchIds=Array.isArray(d.discoveredBenches)?d.discoveredBenches:['bench-0',...this.discovered.map(id=>`bench-${id}`),d.checkpoint.id];
      this.playtime=Math.max(0,Number(d.playtime)||0);this.kills=Math.max(0,Number(d.kills)||0);this.deaths=Math.max(0,Number(d.deaths)||0);this.victory=Boolean(d.victory&&this.defeated.includes('emperor'));
      for(const b of this.world.bosses)b.dead=this.defeated.includes(b.id);for(const m of this.world.memories)m.collected=this.collectedMemories.includes(m.id);for(const c of this.world.decorations)if(c.type==='cog')c.collected=this.collectedCogs.includes(c.id);for(const b of this.world.benches)b.discovered=benchIds.includes(b.id)||b.id===this.checkpoint.id;
      return true;
    }catch{return false;}}
}
