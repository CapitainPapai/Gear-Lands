import { ZONES, BOSSES } from './world.js';
import { clamp, lerp, seeded } from './math.js';

const TAU = Math.PI * 2;
function path(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function ellipse(ctx, x, y, rx, ry, fill, stroke, width = 1) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(.01,rx), Math.max(.01,ry), 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.strokeStyle=color; ctx.lineWidth=width; ctx.stroke();
}
export function gear(ctx, x, y, radius, teeth = 14, rotation = 0, fill = '#574d37', stroke = '#a18a5a', hole = true) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(rotation);
  const points=[];
  for(let i=0;i<teeth;i++) for(let j=0;j<4;j++) {
    const a=(i+j/4)/teeth*TAU, r=radius*(j===0||j===3?.84:1);
    points.push([Math.cos(a)*r,Math.sin(a)*r]);
  }
  path(ctx,points,fill,stroke,.8);
  if(hole){ellipse(ctx,0,0,radius*.61,radius*.61,'#152525',stroke,.8);for(let i=0;i<5;i++){const a=i/5*TAU;line(ctx,Math.cos(a)*radius*.18,Math.sin(a)*radius*.18,Math.cos(a)*radius*.59,Math.sin(a)*radius*.59,fill,radius*.14);}ellipse(ctx,0,0,radius*.21,radius*.21,fill,stroke,.7);ellipse(ctx,0,0,radius*.07,radius*.07,'#142423');}
  ctx.restore();
}
function glow(ctx,x,y,r,color,alpha=.3){ctx.save();ctx.globalAlpha*=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();}
function chain(ctx,x,y,length,t,alpha=.5){ctx.save();ctx.globalAlpha*=alpha;for(let j=0;j<length;j+=11){const xx=x+Math.sin(t*.6+j*.015)*Math.min(4,j*.02);ellipse(ctx,xx,y+j,2.5,5,null,'#776c50',1);}ctx.restore();}

export class Renderer {
  constructor(canvas, game) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.game=game;
    this.width=1440;this.height=760;this.scale=1;this.dpr=1;this.time=0;
    this.images={};this.lastZone=0;this.transition=1;this.shake=0;this.flash=0;
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);
    this.resize();
    const rng=seeded(991);
    this.dust=Array.from({length:75},()=>({x:rng(),y:rng(),r:.5+rng()*1.6,s:.3+rng(),phase:rng()*TAU}));
    this.texture=this.createTexture();
  }
  async load() {
    await Promise.all(ZONES.map(z=>new Promise(resolve=>{const image=new Image();image.onload=()=>{this.images[z.id]=image;resolve();};image.onerror=()=>resolve();image.src=`/art/${z.art}`;})));
  }
  createTexture(){const c=document.createElement('canvas');c.width=180;c.height=180;const x=c.getContext('2d');const rng=seeded(717);for(let i=0;i<1700;i++){x.fillStyle=rng()>.5?'#e2d3a80a':'#06181813';x.fillRect(rng()*180,rng()*180,1+rng()*2,1);}return c;}
  resize(){const rect=this.canvas.getBoundingClientRect();this.dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.round(rect.width*this.dpr);this.canvas.height=Math.round(rect.height*this.dpr);this.scale=rect.height/760;this.width=rect.width/this.scale;this.height=760;}
  kick(amount){if(!this.game.settings.reducedMotion&&this.game.settings.shake)this.shake=Math.max(this.shake,amount);}
  render(dt){
    this.time+=dt;const g=this.game,p=g.player;const ctx=this.ctx;
    if(g.zone.id!==this.lastZone){this.previousZone=this.lastZone;this.lastZone=g.zone.id;this.transition=0;}
    this.transition=Math.min(1,this.transition+dt*.55);
    let targetX=clamp(p.x+p.w/2-this.width*.48+p.facing*45,0,19500-this.width+80);
    let targetY=p.y+p.h/2-this.height*.61;
    targetY=clamp(targetY,g.zone.id===4?-2070:g.zone.id===5?-2180:-240,g.zone.id===5?-1770:100);
    if(!g.started){targetX=clamp(p.x-this.width*.53,0,19500-this.width);targetY=0;}
    g.camera.x=lerp(g.camera.x,targetX,1-Math.exp(-dt*4.2));g.camera.y=lerp(g.camera.y,targetY,1-Math.exp(-dt*3.8));
    this.shake=Math.max(0,this.shake-dt*24);
    const sx=this.shake?(Math.random()-.5)*this.shake:0,sy=this.shake?(Math.random()-.5)*this.shake:0;
    ctx.setTransform(this.dpr*this.scale,0,0,this.dpr*this.scale,0,0);
    ctx.fillStyle='#142627';ctx.fillRect(0,0,this.width,this.height);
    this.drawBackground(ctx,g.zone.id,1);
    if(this.transition<1&&this.previousZone!==undefined)this.drawBackground(ctx,this.previousZone,1-this.transition);
    const atmosphere=ctx.createLinearGradient(0,0,0,760);atmosphere.addColorStop(0,'#0b191b35');atmosphere.addColorStop(.45,'#12302b0a');atmosphere.addColorStop(1,'#08191b88');ctx.fillStyle=atmosphere;ctx.fillRect(0,0,this.width,760);
    this.drawAtmosphere(ctx,false);
    ctx.save();ctx.translate(-g.camera.x+sx,-g.camera.y+sy);
    this.drawWorldDecor(ctx);
    for(const platform of g.world.platforms)if(this.visible(platform.x,platform.y,platform.w,platform.h+180))this.drawPlatform(ctx,platform);
    for(const wall of g.world.walls)if(this.visible(wall.x,wall.y,wall.w,wall.h))this.drawWall(ctx,wall);
    for(const d of g.world.decorations)if(this.visible(d.x,d.y,60,100))this.drawDecoration(ctx,d);
    for(const b of g.world.benches)if(this.visible(b.x-80,b.y-150,200,180))this.drawBench(ctx,b);
    for(const gate of g.world.gates)if(!g.defeated.includes(gate.requirement)&&this.visible(gate.x-50,gate.y,130,gate.h))this.drawGate(ctx,gate);
    for(const b of g.world.bosses)if(b.active&&!b.dead&&b.arenaMin&&this.visible(b.arenaMin-80,ZONES[b.zone].floor-460,120,660))this.drawArenaBarrier(ctx,b);
    for(const m of g.world.memories)if(!m.collected&&this.visible(m.x-40,m.y-40,80,80))this.drawMemory(ctx,m);
    for(const h of g.world.hazards)if(h.type==='steam'&&this.visible(h.x,h.y-150,h.w,180))this.drawSteam(ctx,h);
    for(const e of g.world.enemies)if(!e.dead&&this.visible(e.x-60,e.y-60,e.w+120,e.h+120))this.drawEnemy(ctx,e);
    for(const b of g.world.bosses)if(!b.dead&&this.visible(b.x-130,b.y-130,b.w+260,b.h+260))this.drawBoss(ctx,b);
    for(const trail of g.afterimages)this.drawHero(ctx,trail.x,trail.y,trail.facing,trail.life/.22*.28,{...p,vx:0,grounded:true,attackTimer:0,healing:0},true);
    const burial=g.started?clamp(g.awakening/2.2,0,1)*26:26;
    if(!g.dead||Math.sin(this.time*8)>0)this.drawHero(ctx,p.x,p.y+burial,p.facing,1,p);
    if(burial>0&&this.visible(p.x-90,p.y,210,130))this.drawAwakeningScrap(ctx,p.x+15,p.y+62,burial/26);
    for(const shot of g.projectiles)if(this.visible(shot.x-30,shot.y-30,60,60))this.drawProjectile(ctx,shot);
    this.drawEffects(ctx);
    this.drawParticles(ctx);
    ctx.restore();
    this.drawAtmosphere(ctx,true);
    ctx.save();ctx.globalAlpha=.45;ctx.fillStyle=ctx.createPattern(this.texture,'repeat');ctx.fillRect(0,0,this.width,this.height);ctx.restore();
    const vignette=ctx.createRadialGradient(this.width*.5,350,this.width*.15,this.width*.5,380,this.width*.75);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#0513156b');ctx.fillStyle=vignette;ctx.fillRect(0,0,this.width,this.height);
  }
  visible(x,y,w=0,h=0){const c=this.game.camera;return x+w>c.x-180&&x<c.x+this.width+180&&y+h>c.y-200&&y<c.y+this.height+200;}
  drawBackground(ctx,id,alpha){const image=this.images[id];if(!image)return;const g=this.game,z=ZONES[id];ctx.save();ctx.globalAlpha=alpha;
    const scale=Math.max((this.width+150)/image.width,(this.height+130)/image.height);
    const w=image.width*scale,h=image.height*scale;
    const progress=clamp((g.camera.x-z.start)/(z.end-z.start),0,1);
    const x=-(w-this.width)*(.2+progress*.6),y=-(h-this.height)*.48;
    const vertical=id===4?clamp(-g.camera.y*.035,-20,80):id===5?35:0;
    ctx.drawImage(image,x,y+vertical,w,h);
    ctx.fillStyle=id===2?'#123c3920':id===5?'#14283b22':'#0d25251c';ctx.fillRect(0,0,this.width,this.height);
    const fog=ctx.createLinearGradient(0,360,0,760);fog.addColorStop(0,'transparent');fog.addColorStop(.65,id===2?'#557b6927':'#9b967322');fog.addColorStop(1,'#10272555');ctx.fillStyle=fog;ctx.fillRect(0,0,this.width,this.height);ctx.restore();}
  drawAtmosphere(ctx,front){const g=this.game,t=this.time;ctx.save();for(let i=0;i<this.dust.length;i++){if(front&&i%3)continue;const d=this.dust[i];const x=((d.x*this.width+t*d.s*9-g.camera.x*(front?.12:.035))%this.width+this.width)%this.width;const y=((d.y*this.height-t*d.s*4+Math.sin(t*.3+d.phase)*14-g.camera.y*.025)%this.height+this.height)%this.height;const a=.15+(Math.sin(t*.7+d.phase)+1)*.15;ctx.globalAlpha=a;ellipse(ctx,x,y,d.r*(front?1.4:.8),d.r*(front?1.4:.8),g.zone.id===2?'#bcebd4':'#e4cc94');if(front&&i%9===0)glow(ctx,x,y,10,'#d6bd78',.4);}ctx.restore();}
  drawWorldDecor(ctx){const g=this.game,t=this.time;
    for(let i=0;i<14;i++){const x=Math.floor(g.camera.x/650)*650+i*650-650;if(!this.visible(x,100,350,800))continue;const z=ZONES.find(z=>x>=z.start&&x<z.end)||g.zone;const y=z.floor;ctx.save();ctx.globalAlpha=.28;
      gear(ctx,x+100,y-130,95,20,t*.04*(i%2?1:-1),'#34443a','#7b7955');
      gear(ctx,x+224,y-65,53,14,-t*.071,'#39463a','#817854');
      chain(ctx,x+360,y-650,400,t+i,.7);ctx.restore();}
    if(g.zone.id===4){const x=15480;ctx.save();ctx.globalAlpha=.23;gear(ctx,x,-620,260,32,t*.025,'#665c3d','#b19761');gear(ctx,x+260,-960,170,24,-t*.038,'#655b3c','#a58c5c');ctx.restore();}
  }
  drawPlatform(ctx,p){const rng=seeded(p.id*713+41);const y=p.y,x=p.x,w=p.w;const ground=p.type==='ground';const h=ground?300:p.h;
    const colors={scrap:['#344039','#172825','#93815a'],iron:['#394239','#142622','#a28d60'],stone:['#3d5148','#1b302c','#8c9e81'],capital:['#454938','#1b2b24','#b19b65'],citadel:['#3c4436','#172821','#aa925e'],checkpoint:['#45533f','#1b2d25','#b4a475'],ground:['#303d33','#10221f','#8c8058']}[p.type]||['#344039','#172825','#93815a'];
    const grad=ctx.createLinearGradient(0,y,0,y+h);grad.addColorStop(0,colors[0]);grad.addColorStop(1,colors[1]);
    const top=[[x,y+4]];for(let xx=x;xx<x+w;xx+=18)top.push([xx,y+rng()*4-2]);top.push([x+w,y+2],[x+w,y+h],[x,y+h]);path(ctx,top,grad);
    line(ctx,x+2,y+3,x+w-2,y+3,colors[2],2);line(ctx,x,y+7,x+w,y+7,'#0c1d1baa',2);
    if(ground){
      for(let xx=x+8;xx<x+w-8;xx+=24+rng()*30){const depth=15+rng()*65;path(ctx,[[xx,y+9],[xx+20+rng()*25,y+10],[xx+30,y+depth],[xx+4,y+depth+8]],rng()>.5?'#48503b35':'#77806518','#a49b6514',.7);if(rng()>.55)line(ctx,xx,y+12,xx+18,y+15+rng()*20,'#b4a57420',1);}
      for(let xx=x+25;xx<x+w;xx+=90+rng()*100){const size=8+rng()*20;ctx.save();ctx.globalAlpha=.55;gear(ctx,xx,y+size*.35,size,10,rng()*5,'#4b5039','#8c8055');ctx.restore();}
    }else{
      line(ctx,x+3,y+h-3,x+w-3,y+h-3,'#716a4544',1);
      for(let xx=x+12;xx<x+w-8;xx+=32){ellipse(ctx,xx,y+13,2,2,'#b1a07788');line(ctx,xx-1,y+12,xx+1,y+14,'#182a22',.7);}
      path(ctx,[[x+15,y+h],[x+42,y+h],[x+28,y+h+25]],'#24362c','#746c4544');path(ctx,[[x+w-42,y+h],[x+w-15,y+h],[x+w-28,y+h+25]],'#24362c','#746c4544');
      if(p.w>170){line(ctx,x+35,y+h+18,x+w-35,y+h+18,'#66704a44',2);}
      if(p.type==='stone'){for(let xx=x+8;xx<x+w;xx+=23){ctx.beginPath();ctx.moveTo(xx,y);ctx.quadraticCurveTo(xx-8,y-10,xx-4,y-16-rng()*9);ctx.strokeStyle='#6e94736b';ctx.lineWidth=1.4;ctx.stroke();}}
    }
  }
  drawWall(ctx,w){ctx.fillStyle='#24352c';ctx.fillRect(w.x,w.y,w.w,w.h);line(ctx,w.x+3,w.y,w.x+3,w.y+w.h,'#a78e5b88',2);line(ctx,w.x+w.w-3,w.y,w.x+w.w-3,w.y+w.h,'#7e805144',2);for(let y=w.y+15;y<w.y+w.h;y+=48){ellipse(ctx,w.x+w.w/2,y,3,3,'#a5956577');line(ctx,w.x+5,y+12,w.x+w.w-5,y+25,'#76845b33');}}
  drawDecoration(ctx,d){const t=this.time;ctx.save();ctx.translate(d.x,d.y);ctx.scale(d.scale||1,d.scale||1);
    if(d.type==='cog'){if(d.collected){ctx.restore();return;}const bob=Math.sin(t*2+d.seed)*4;glow(ctx,0,-8+bob,22,'#d6b56b',.16);gear(ctx,0,-8+bob,7,9,t*.3+d.seed,'#ad9257','#ddc58a');ctx.restore();return;}
    if(d.type==='scrap'){
      ctx.globalAlpha=.85;gear(ctx,-15,-10,23,13,.4,'#3c4836','#7e7750');gear(ctx,20,-8,15,10,1.2,'#4c4e37','#918159');path(ctx,[[-32,-4],[-24,-38],[-9,-33],[-3,-7]],'#3c4939','#8d805344');path(ctx,[[4,-3],[14,-30],[37,-24],[30,-2]],'#46503a','#8d805344');line(ctx,17,-26,29,-22,'#b29b6544',2);ellipse(ctx,-14,-32,5,3,'#182b24','#7c7850');
    }else if(d.type==='lamp'){
      const flicker=.85+Math.sin(t*6+d.seed)*.05;line(ctx,0,0,0,-102,'#344735',5);line(ctx,2,-2,2,-100,'#8c875244',1);ctx.beginPath();ctx.moveTo(0,-99);ctx.quadraticCurveTo(0,-117,18,-115);ctx.quadraticCurveTo(27,-114,27,-103);ctx.strokeStyle='#6f7450';ctx.lineWidth=3;ctx.stroke();path(ctx,[[19,-103],[35,-103],[32,-82],[22,-82]],'#ba9c5866','#8e8454',1.5);path(ctx,[[17,-103],[37,-103],[27,-111]],'#344632','#8c835144');glow(ctx,27,-92,63,'#d8b76c',.23*flicker);ellipse(ctx,27,-93,3,7,'#e9ce88');line(ctx,22,-83,32,-83,'#c4a56b',2);
    }else if(d.type==='flowers'){
      for(let i=0;i<5;i++){const x=(i-2)*8,h=12+Math.sin(i*7+d.seed)*8;ctx.beginPath();ctx.moveTo(x,0);ctx.quadraticCurveTo(x+5,-h*.6,x+Math.sin(t+i)*2,-h);ctx.strokeStyle='#739981aa';ctx.lineWidth=1;ctx.stroke();const xx=x+Math.sin(t+i)*2;ellipse(ctx,xx,-h,3,2,'#b0d7bc');glow(ctx,xx,-h,13,'#a2e5c4',.17);}
    }else{line(ctx,-8,0,-8,-48,'#4c5b3e',8);line(ctx,-8,-47,17,-47,'#5d6745',8);line(ctx,-10,-2,-10,-46,'#a4935a44',1);ellipse(ctx,-8,-24,9,4,'#4b573a','#8e8352');}
    ctx.restore();
  }
  drawBench(ctx,b){const t=this.time,x=b.x,y=b.y;const lit=b.discovered;glow(ctx,x,y-65,145,lit?'#e4c580':'#c8bc83',lit?.28:.14);glow(ctx,x,y-15,85,'#d4b978',.1);
    path(ctx,[[x-44,y-24],[x+39,y-24],[x+43,y-17],[x-47,y-17]],'#665c3e','#b09b69',1);line(ctx,x-34,y-17,x-37,y,'#766e49',5);line(ctx,x+31,y-17,x+34,y,'#766e49',5);line(ctx,x-35,y-26,x-35,y-53,'#726d47',3);line(ctx,x+32,y-26,x+32,y-53,'#726d47',3);line(ctx,x-35,y-46,x+32,y-46,'#8c8054',4);line(ctx,x-35,y-36,x+32,y-36,'#6a6744',3);
    line(ctx,x+56,y,x+56,y-117,'#77764d',4);ctx.beginPath();ctx.moveTo(x+56,y-114);ctx.quadraticCurveTo(x+55,y-137,x+35,y-132);ctx.quadraticCurveTo(x+25,y-130,x+28,y-120);ctx.strokeStyle='#a29361';ctx.lineWidth=3;ctx.stroke();
    path(ctx,[[x+18,y-119],[x+38,y-119],[x+35,y-92],[x+22,y-92]],'#bfa56733','#b49c67',1.4);path(ctx,[[x+16,y-119],[x+40,y-119],[x+28,y-129]],'#4e593b','#b39c62',1);line(ctx,x+21,y-91,x+36,y-91,'#b9a16b',2);
    const flicker=1+Math.sin(t*8)*.08;ellipse(ctx,x+28,y-106,3.5*flicker,8*flicker,'#eed59b');glow(ctx,x+28,y-106,43,'#edc575',.45);gear(ctx,x+56,y-56,8,10,t*.13,'#857747','#c0ab74');
    if(lit){ctx.save();ctx.globalAlpha=.65;for(let i=0;i<5;i++){const a=t*.4+i*1.7;ellipse(ctx,x+28+Math.sin(a)*22,y-105+Math.cos(a*.8)*25,1,1,'#e9d394');}ctx.restore();}
  }
  drawGate(ctx,gate){const x=gate.x,y=this.game.zone.floor;const t=this.time;ctx.save();const gradient=ctx.createLinearGradient(x-25,0,x+55,0);gradient.addColorStop(0,'transparent');gradient.addColorStop(.5,'#c3a36b38');gradient.addColorStop(1,'transparent');ctx.fillStyle=gradient;ctx.fillRect(x-25,y-1200,80,1300);for(let i=0;i<4;i++)line(ctx,x+i*7,y-1200,x+i*7,y,'#c4ad7544',1);gear(ctx,x+12,y-115,35,16,t*.08,'#4c5138','#baa26c');ellipse(ctx,x+12,y-115,13,13,'#233629','#d0b77b',1.5);path(ctx,[[x+8,y-120],[x+16,y-120],[x+18,y-108],[x+6,y-108]],'#c7ad73');ellipse(ctx,x+12,y-122,5,5,null,'#c7ad73',2);ctx.font='9px Manrope';ctx.textAlign='center';ctx.fillStyle='#d1bd91';ctx.fillText('ПЕЧАТЬ ХРАНИТЕЛЯ',x+12,y-166);ctx.restore();}
  drawArenaBarrier(ctx,b){const x=b.arenaMin-50,y=ZONES[b.zone].floor,t=this.time;ctx.save();const grad=ctx.createLinearGradient(x-24,0,x+24,0);grad.addColorStop(0,'transparent');grad.addColorStop(.5,b.color+'55');grad.addColorStop(1,'transparent');ctx.fillStyle=grad;ctx.fillRect(x-24,y-460,48,660);for(let i=0;i<3;i++)line(ctx,x-6+i*6,y-460,x-6+i*6,y+180,b.color+'66',1);for(let j=0;j<7;j++){const yy=y-420+j*95+Math.sin(t*2+j)*5;gear(ctx,x,yy,11,10,t*.4+j,'#4c5138',b.color+'99');}ctx.restore();}
  drawMemory(ctx,m){const t=this.time,y=m.y+Math.sin(t*1.8)*6;glow(ctx,m.x,y,55,'#bce4cf',.3);ctx.save();ctx.translate(m.x,y);ctx.rotate(Math.sin(t*.7)*.12);path(ctx,[[0,-16],[10,0],[0,16],[-10,0]],'#b9dbbf55','#e1ecd0',1);path(ctx,[[0,-9],[5,0],[0,9],[-5,0]],'#dfedce');for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(s*8,0);ctx.quadraticCurveTo(s*28,-18,s*25,-3);ctx.quadraticCurveTo(s*18,8,s*8,0);ctx.fillStyle='#b5d6b633';ctx.fill();ctx.strokeStyle='#c3d8b577';ctx.lineWidth=.8;ctx.stroke();}ctx.restore();}
  drawSteam(ctx,h){const phase=(this.game.elapsed+h.phase)%4.8;const active=phase>2.8;ctx.fillStyle='#4b5138';ctx.fillRect(h.x,h.y,h.w,12);for(let i=0;i<5;i++)line(ctx,h.x+7+i*12,h.y+2,h.x+7+i*12,h.y+9,'#172b23',3);if(active){const strength=clamp((phase-2.8)*3,0,1);for(let i=0;i<9;i++){const yy=h.y-((this.time*130+i*19)%145);const xx=h.x+h.w/2+Math.sin(this.time*2+i)*12;ctx.save();ctx.globalAlpha=.13*strength*(1-(h.y-yy)/170);ellipse(ctx,xx,yy,15+(h.y-yy)*.1,20,'#d1d9c2');ctx.restore();}glow(ctx,h.x+h.w/2,h.y-20,55,'#d5ba81',.15);}else if(phase>2.1){glow(ctx,h.x+h.w/2,h.y,35,'#d9aa63',.2);}}
  drawHero(ctx,x,y,facing,alpha,p,trail=false){const t=this.time;const moving=Math.abs(p.vx||0)>25;const run=moving?Math.sin(t*14):0;const bob=p.grounded?(moving?Math.abs(run)*2:Math.sin(t*2)*1.1):0;const dashing=p.dashTimer>0;ctx.save();ctx.globalAlpha=alpha;
    if(!trail)ellipse(ctx,x+15,y+63,24,5,'#06171366');ctx.translate(x+15,y+62+bob);ctx.scale(facing,1);if(dashing)ctx.rotate(.17);else if(moving)ctx.rotate(.055);
    if(p.invuln>0&&!trail)ctx.globalAlpha*=.55+Math.sin(t*35)*.25;
    // Cloth and copper scarf, animated independently from the articulated limbs.
    const flutter=Math.sin(t*7)*4+(moving?8:0);
    ctx.beginPath();ctx.moveTo(-5,-42);ctx.quadraticCurveTo(-17,-37,-27-flutter,-34+Math.sin(t*6)*4);ctx.quadraticCurveTo(-20,-28,-29-flutter,-25+Math.cos(t*5)*3);ctx.quadraticCurveTo(-12,-29,2,-36);ctx.closePath();ctx.fillStyle=trail?'#a9d4c2':'#a47c4c';ctx.fill();line(ctx,-4,-39,-22-flutter,-33,'#d0aa7044',1);
    ctx.beginPath();ctx.moveTo(-8,-37);ctx.quadraticCurveTo(-18,-24,-15-(moving?5:0),-9);ctx.lineTo(-5,-14);ctx.lineTo(2,-8);ctx.lineTo(8,-29);ctx.closePath();ctx.fillStyle=trail?'#8cc7b4':'#293f36';ctx.fill();ctx.strokeStyle='#75856a66';ctx.lineWidth=.8;ctx.stroke();
    const leg=(side,phase)=>{const hip=side*5,kneeX=hip+phase*6,footX=hip+phase*10;ctx.beginPath();ctx.moveTo(hip,-20);ctx.lineTo(kneeX,-10);ctx.lineTo(footX,p.grounded?-1:-5);ctx.strokeStyle=trail?'#a1d4be':side<0?'#405749':'#81907a';ctx.lineWidth=5;ctx.lineCap='round';ctx.stroke();ellipse(ctx,kneeX,-10,3.1,3.1,trail?'#a1d4be':'#b09a65','#304638',.8);path(ctx,[[footX-4,-4],[footX+4,-4],[footX+7,0],[footX-4,0]],trail?'#a1d4be':'#65745c','#a6a27b66',.7);};
    leg(-1,p.grounded?run:-.45);leg(1,p.grounded?-run:.5);
    path(ctx,[[-9,-40],[7,-41],[11,-27],[6,-18],[-7,-19],[-11,-30]],trail?'#abd8c0':'#65765d','#bcc0a066',1);path(ctx,[[1,-39],[8,-37],[9,-28],[3,-23]],trail?'#abd8c0':'#a48e5e','#d2bd8244',.7);line(ctx,-6,-32,2,-32,'#263f32',2);ellipse(ctx,2,-31,3,3,trail?'#d1f0d7':'#b7d9ba');if(!trail)glow(ctx,2,-31,13,'#b7dfb6',.35);
    // Mechanical left arm and sword hand.
    line(ctx,-9,-36,-13,-25,trail?'#aad5bd':'#849077',4);ellipse(ctx,-13,-25,2.8,2.8,'#b29c6c');line(ctx,-13,-24,-9,-18,'#607658',3);
    const attack=p.attackTimer>0;const handX=attack?19:13,handY=attack?-32:-24;line(ctx,8,-36,handX,handY,trail?'#abd8c0':'#ad9b70',4);ellipse(ctx,9,-36,4.5,4.5,trail?'#abd8c0':'#536a52','#bdad7866',.8);
    ctx.save();ctx.translate(handX,handY);ctx.rotate(attack?-1.3+(.32-p.attackTimer)*8:.55);path(ctx,[[-2,2],[2,2],[3,-29],[0,-39],[-3,-29]],trail?'#c4e8d0':'#c4cbb0','#eef0cc88',.7);line(ctx,0,-4,0,-32,'#f0ecd1',.7);line(ctx,-6,1,6,1,'#baa16b',2);line(ctx,0,2,0,8,'#7c754c',3);ctx.restore();
    // Ivory half-mask, exposed brass temple, asymmetric horns / antennae.
    ctx.beginPath();ctx.moveTo(-11,-52);ctx.bezierCurveTo(-12,-65,7,-67,12,-56);ctx.lineTo(11,-45);ctx.quadraticCurveTo(4,-37,-6,-42);ctx.quadraticCurveTo(-12,-44,-11,-52);ctx.closePath();ctx.fillStyle=trail?'#c3e5ce':'#d4d5b9';ctx.fill();ctx.strokeStyle='#e7e5c588';ctx.lineWidth=.8;ctx.stroke();
    path(ctx,[[4,-63],[10,-60],[12,-52],[10,-44],[5,-41],[6,-51]],trail?'#a4d0b6':'#8e9b7e','#c0b78a66',.6);
    ctx.beginPath();ctx.moveTo(-8,-60);ctx.quadraticCurveTo(-16,-67,-12,-75);ctx.quadraticCurveTo(-10,-68,-4,-64);ctx.fillStyle=trail?'#b7dfc4':'#b8c2a5';ctx.fill();ctx.beginPath();ctx.moveTo(5,-63);ctx.lineTo(9,-73);ctx.lineTo(11,-61);ctx.fillStyle=trail?'#b7dfc4':'#9da78a';ctx.fill();
    ellipse(ctx,-5,-52,2.6,4.1,trail?'#315b48':'#18332c');ellipse(ctx,6,-52,2.4,3.1,trail?'#e1f5d5':'#e5c57c');line(ctx,5,-46,8,-46,'#4d654b',.8);line(ctx,8,-59,10,-56,'#d7c79b',.7);
    if(!trail){glow(ctx,6,-52,11,'#e5c57c',.25);if(p.healing>0){glow(ctx,0,-28,65,'#cde7b4',.3);ctx.strokeStyle='#d7e7bbaa';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(0,-27,25,36,0,-Math.PI/2,-Math.PI/2+TAU*(1-p.healing/.85));ctx.stroke();}if(p.flightFuel>0&&p.flightFuel<.95&&!p.grounded){for(let i=0;i<3;i++)path(ctx,[[-6+i*5,-15],[-3+i*5,5+Math.random()*10],[i*5,-13]],'#b5e2c288');}}
    if(attack&&!trail){const progress=1-p.attackTimer/.32;ctx.save();ctx.globalAlpha*=Math.sin(progress*Math.PI)*.9;ctx.beginPath();ctx.arc(7,-32,66,-1.3+progress*.5,1.15+progress*.5);ctx.strokeStyle='#f0e6bc';ctx.lineWidth=4;ctx.stroke();ctx.beginPath();ctx.arc(7,-32,73,-1.1+progress*.5,.95+progress*.5);ctx.strokeStyle='#d3c59066';ctx.lineWidth=8;ctx.stroke();ctx.restore();}
    ctx.restore();
  }
  drawAwakeningScrap(ctx,x,floor,amount){ctx.save();ctx.globalAlpha=amount;const rng=seeded(417);
    for(let i=0;i<11;i++){const ox=(rng()-.5)*150,oy=-rng()*24,r=9+rng()*19;gear(ctx,x+ox,floor+oy,r,10+i%4,rng()*6,i%2?'#4b5039':'#3b4737',i%2?'#9b895b':'#777b52');}
    path(ctx,[[x-76,floor+4],[x-52,floor-24],[x-20,floor-16],[x+8,floor-31],[x+44,floor-18],[x+78,floor+4]],'#344233','#8f815444',1);
    path(ctx,[[x-34,floor-8],[x-18,floor-42],[x-4,floor-36],[x-12,floor-6]],'#46523b','#a8956244',1);
    path(ctx,[[x+16,floor-6],[x+31,floor-34],[x+48,floor-25],[x+38,floor-4]],'#3e4b38','#a8956233',1);ctx.restore();}
  drawEnemy(ctx,e){const t=this.time;ctx.save();ctx.translate(e.x+e.w/2,e.y+e.h);ctx.scale(e.dir||1,1);if(e.hit>0){ctx.shadowColor='#eee4bb';ctx.shadowBlur=12;}const windup=e.attackTimer<.38&&e.state==='windup';
    if(e.type==='crawler'){
      ellipse(ctx,0,1,27,4,'#06171355');for(let i=0;i<3;i++){const a=Math.sin(t*11+i*2)*4;for(const s of [-1,1]){line(ctx,s*(7+i*4),-12,s*(15+i*5)+a,-3,'#8d8960',2);line(ctx,s*(15+i*5)+a,-3,s*(20+i*4)+a,0,'#536747',2);}}
      ellipse(ctx,0,-17,24,15,'#596147','#ac9865',1.2);gear(ctx,-3,-18,13,12,t*.3,'#7e7950','#b3a16b');path(ctx,[[12,-26],[24,-20],[28,-10],[14,-8]],'#485b40','#998d5b',1);ellipse(ctx,22,-17,3,2.5,windup?'#ffe1a0':'#d29a65');glow(ctx,22,-17,12,'#d9995e',.25);line(ctx,-17,-27,-22,-34,'#9b9160',1.4);
    }else if(e.type==='drone'){
      const flap=Math.sin(t*19)*.4;for(const s of [-1,1]){ctx.save();ctx.scale(s,1);ctx.rotate(flap);path(ctx,[[8,-23],[37,-39],[31,-19],[12,-12]],'#73806477','#b6ad7b88',1);line(ctx,10,-21,32,-32,'#c1b17b77',1);ctx.restore();}ellipse(ctx,0,-20,17,16,'#65704d','#b7a675',1);gear(ctx,0,-20,12,12,-t*.7,'#8d8254','#c4b47d');ellipse(ctx,6,-20,4,4,windup?'#f5d89a':'#d7a26a');glow(ctx,6,-20,18,'#e4b876',.24);line(ctx,-3,-5,-5,3,'#a89f6d',2);ellipse(ctx,0,-38,12,2,'#a5b28b66');line(ctx,0,-35,0,-40,'#9b9d6d',2);
    }else{
      ellipse(ctx,0,2,23,5,'#06171355');const walk=Math.sin(t*7+e.x)*3;line(ctx,-8,-24,-11+walk,-3,'#788365',7);line(ctx,8,-24,11-walk,-3,'#9b9469',7);path(ctx,[[-16,-48],[13,-48],[17,-28],[8,-19],[-12,-21]],'#59694b','#a69f6c',1);gear(ctx,-1,-35,11,11,t*.2,'#8c8457','#b9a675');ellipse(ctx,0,-57,12,12,'#889172','#c1b58a',1);path(ctx,[[-13,-61],[12,-61],[14,-54],[-13,-54]],'#344c36');line(ctx,3,-57,10,-57,windup?'#ffe0a0':'#d5a571',2);line(ctx,14,-42,23,-28,'#a29868',6);line(ctx,23,-28,windup?34:27,windup?-50:-10,'#b7b491',4);path(ctx,[[-19,-46],[-8,-49],[-9,-35],[-22,-33]],'#7c8057','#c0ac75',1);
    }
    if(e.hp<e.maxHp){ctx.fillStyle='#0d211ddd';ctx.fillRect(-20,-e.h-16,40,3);ctx.fillStyle='#c3a272';ctx.fillRect(-20,-e.h-16,40*e.hp/e.maxHp,3);}
    if(windup){ctx.fillStyle='#e4bc7d';ctx.font='bold 16px Manrope';ctx.textAlign='center';ctx.fillText('!',0,-e.h-23);}
    ctx.restore();
  }
  drawBoss(ctx,b){const t=this.time;ctx.save();ctx.translate(b.x+b.w/2,b.y+b.h);ctx.scale(b.dir||1,1);const s=b.h/140;ctx.scale(s,s);const windup=b.state==='windup';const pulse=.5+Math.sin(t*5)*.2;const color=b.color;
    ellipse(ctx,0,3,57,9,'#06171377');
    if(windup){glow(ctx,0,-65,120,'#e0a26b',pulse*.35);ctx.save();ctx.globalAlpha=.3+pulse*.3;ctx.strokeStyle='#dfb17b';ctx.lineWidth=1.5;ctx.setLineDash([6,7]);ctx.beginPath();ctx.ellipse(0,0,b.attackKind==='slam'?160:90,13,0,0,TAU);ctx.stroke();ctx.restore();}
    if(b.hit>0){ctx.shadowColor='#f4e8be';ctx.shadowBlur=15;}
    if(b.id==='scrap'){
      const walk=b.active?Math.sin(t*5)*4:0;line(ctx,-24,-43,-29+walk,-7,'#777b56',17);line(ctx,24,-43,29-walk,-7,'#9b8d5e',17);path(ctx,[[-44,-13],[-18,-13],[-13,0],[-48,0]],'#596448','#b09b65',1.5);path(ctx,[[15,-13],[40,-13],[48,0],[13,0]],'#747451','#b09b65',1.5);
      path(ctx,[[-42,-101],[32,-108],[48,-73],[31,-35],[-30,-36],[-48,-70]],'#657052','#b8a372',2);gear(ctx,-35,-95,31,16,t*.12,'#7c7952','#c2a975');gear(ctx,34,-96,25,14,-t*.15,'#8d8054','#c7ab73');path(ctx,[[-24,-88],[23,-88],[27,-51],[-25,-51]],'#263d2d','#a89964',2);for(let i=0;i<5;i++)line(ctx,-17+i*9,-82,-17+i*9,-57,'#c3a56b',3);glow(ctx,0,-70,55,'#e5b46d',.3);ellipse(ctx,0,-70,10,13,'#dcb774');
      line(ctx,-43,-81,-57,-49,'#8b875c',15);line(ctx,43,-81,windup?65:58,windup?-118:-48,'#a09261',17);ctx.save();ctx.translate(windup?65:58,windup?-118:-48);ctx.rotate(windup?-.7:.2);line(ctx,0,10,0,-37,'#9c8d5b',7);path(ctx,[[-24,-53],[23,-53],[27,-29],[-25,-29]],'#72764f','#c3ae77',2);gear(ctx,0,-41,13,10,0,'#99875a','#cfb780');ctx.restore();
      path(ctx,[[-21,-124],[17,-128],[26,-111],[17,-97],[-19,-100],[-27,-112]],'#9b9c75','#d0bd87',1.3);path(ctx,[[-23,-115],[22,-116],[19,-107],[-21,-107]],'#263e2d');line(ctx,-14,-111,-5,-111,'#e6c17d',3);line(ctx,7,-111,17,-111,'#e6c17d',3);line(ctx,-12,-128,-17,-141,'#a29360',5);
    }else if(b.id==='clock'){
      const float=Math.sin(t*2)*3;ctx.translate(0,float);path(ctx,[[-22,-102],[20,-102],[42,-4],[20,-12],[0,0],[-22,-10],[-40,-3]],'#354e3c','#a5a16d',1.4);for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(-18+i*9,-90);ctx.quadraticCurveTo(-25+i*13,-45,-30+i*15,-8);ctx.strokeStyle=i%2?'#b0a06b44':'#172f2777';ctx.lineWidth=2;ctx.stroke();}gear(ctx,0,-76,25,18,t*.1,'#8c8154','#c8b47a');ellipse(ctx,0,-76,12,12,'#283f2e','#d0bd85',1);line(ctx,0,-76,Math.cos(t)*9,-76+Math.sin(t)*9,'#d8c692',1.5);
      ellipse(ctx,0,-119,24,27,'#acac7d','#e0cea0',1.5);ellipse(ctx,0,-119,20,22,'#344d36','#c5b17b',1);for(let i=0;i<12;i++){const a=i/12*TAU;line(ctx,Math.cos(a)*16,-119+Math.sin(a)*18,Math.cos(a)*19,-119+Math.sin(a)*21,'#cbbb87',1);}line(ctx,0,-119,Math.sin(t*.4)*14,-119-Math.cos(t*.4)*14,'#ecd6a0',1.7);line(ctx,0,-119,-9,-125,'#d3bc84',2.5);ellipse(ctx,0,-119,3,3,'#e5c889');path(ctx,[[-27,-139],[26,-139],[15,-148],[-17,-148]],'#5f6b47','#bbaa72',1);path(ctx,[[-15,-148],[-11,-168],[12,-168],[16,-148]],'#4b6041','#b5a572',1);
      line(ctx,21,-91,40,-66,'#a99f6b',6);line(ctx,40,-66,windup?62:48,windup?-100:-51,'#c0b17c',5);ctx.save();ctx.translate(windup?62:48,windup?-100:-51);ctx.rotate(windup?-1:.25);line(ctx,0,25,0,-72,'#b4a575',3);gear(ctx,0,-65,17,12,t*.4,'#a28e5b','#dfc58b');path(ctx,[[0,-83],[22,-69],[28,-48],[5,-54]],'#c5c5a0','#e4d8ad',1);ctx.restore();
    }else if(b.id==='abbess'){
      ctx.translate(0,-10+Math.sin(t*1.8)*8);for(const side of [-1,1]){ctx.save();ctx.scale(side,1);for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(14,-95+i*6);ctx.quadraticCurveTo(50+i*8,-135+i*8,72+i*4,-110+i*14);ctx.quadraticCurveTo(54,-76+i*7,17,-57);ctx.fillStyle=i%2?'#78977a88':'#a4b49677';ctx.fill();ctx.strokeStyle='#c7d3ad77';ctx.lineWidth=.8;ctx.stroke();}ctx.restore();}
      path(ctx,[[-17,-104],[18,-104],[34,-9],[17,-18],[0,-2],[-18,-17],[-35,-8]],'#537b62','#b4cbae',1.2);for(let i=0;i<5;i++)line(ctx,-12+i*6,-85,-25+i*12,-15,'#bfd4b544',1.2);gear(ctx,0,-83,17,14,-t*.1,'#8fa98a','#d2dcc0');ellipse(ctx,0,-83,7,9,'#c6e4c4');glow(ctx,0,-83,40,'#bce6c5',.3);
      ellipse(ctx,0,-121,16,22,'#c5d1b3','#e1e7c9',1);path(ctx,[[-16,-127],[16,-127],[12,-118],[-12,-118]],'#496f54');line(ctx,-9,-123,-3,-123,'#cdebc8',1.5);line(ctx,4,-123,10,-123,'#cdebc8',1.5);ellipse(ctx,0,-128,31,31,null,'#c8c79588',1.2);gear(ctx,0,-128,36,24,t*.04,'#b5bd8733','#d4cf9c77',false);ellipse(ctx,0,-128,26,26,'#294e3700','#cdd4a777',.8);
      for(const side of [-1,1]){line(ctx,side*17,-91,side*38,-67,'#b2c5a3',4);line(ctx,side*38,-67,side*(windup?58:44),windup?-98:-54,'#c8d8b7',3);glow(ctx,side*(windup?58:44),windup?-98:-54,25,'#c0e6c4',windup?.5:.18);}
    }else{
      const cape=Math.sin(t*3)*7;ctx.beginPath();ctx.moveTo(-21,-119);ctx.quadraticCurveTo(-51,-86,-57-cape,-3);ctx.lineTo(-26,-12);ctx.lineTo(-8,0);ctx.lineTo(23,-13);ctx.lineTo(38,-5);ctx.quadraticCurveTo(28,-84,20,-119);ctx.closePath();ctx.fillStyle='#694e37';ctx.fill();ctx.strokeStyle='#bc9c62';ctx.lineWidth=1.3;ctx.stroke();
      line(ctx,-13,-42,-18,-5,'#b6a475',8);line(ctx,13,-42,18,-5,'#cbb780',8);path(ctx,[[-24,-9],[ -8,-9],[-5,0],[-28,0]],'#8f8c5c','#dfc68b',1);path(ctx,[[10,-9],[24,-9],[30,0],[8,0]],'#a79a65','#dfc68b',1);
      path(ctx,[[-25,-111],[23,-111],[29,-80],[16,-40],[-17,-40],[-29,-80]],'#a99c68','#e1c88f',1.5);path(ctx,[[-17,-100],[17,-100],[12,-63],[0,-52],[-12,-63]],'#4c6244','#d1b97d',1.3);gear(ctx,0,-81,15,16,t*.17,'#bba36a','#f0d499');glow(ctx,0,-81,40,'#ecd08a',.28);
      for(const side of [-1,1]){gear(ctx,side*27,-106,16,13,side*t*.1,'#a89861','#e0c58a');line(ctx,side*28,-95,side*39,-66,'#c4b17a',7);line(ctx,side*39,-66,side*(windup?58:42),windup?-90:-52,'#d7c18a',5);}
      ctx.save();ctx.translate(windup?58:42,windup?-90:-52);ctx.rotate(windup?-1.2:.4);path(ctx,[[-2,0],[2,0],[3,-77],[0,-94],[-3,-77]],'#e0dec0','#faf0c9',1);line(ctx,-9,0,9,0,'#e1c383',3);ellipse(ctx,0,6,3,4,'#cba96b');ctx.restore();
      ellipse(ctx,0,-128,16,21,'#c9c8a2','#e9d9ad',1);path(ctx,[[2,-147],[15,-140],[17,-124],[9,-110],[2,-113]],'#9c9e72','#d8c58d',.8);line(ctx,-10,-130,-4,-130,'#344d35',2);line(ctx,6,-130,12,-130,'#f1d18c',2);path(ctx,[[-18,-145],[-21,-163],[-10,-155],[0,-171],[9,-155],[20,-163],[17,-145]],'#bca16a','#edcf91',1.2);ellipse(ctx,0,-152,3,3,'#d9e4bd');gear(ctx,0,-134,37,28,-t*.06,'#b7a46b18','#d6bd7977',false);
    }
    if(b.state==='windup'){ctx.fillStyle='#e5bf83';ctx.font='19px Manrope';ctx.textAlign='center';ctx.fillText('!',0,-183);}
    ctx.restore();
  }
  drawProjectile(ctx,s){const t=this.time;ctx.save();ctx.translate(s.x,s.y);const color=s.owner==='player'?'#bcdcc0':s.color||'#ddb27b';glow(ctx,0,0,s.r*4,color,.3);if(s.kind==='slash'){ctx.rotate(Math.atan2(s.vy,s.vx));ctx.beginPath();ctx.arc(-8,0,s.r*2,-1.1,1.1);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();}else{ellipse(ctx,0,0,s.r,s.r,color);ellipse(ctx,-s.vx*.008,-s.vy*.008,s.r*.65,s.r*.65,'#f3e8bd');ctx.beginPath();ctx.moveTo(0,-s.r*.6);ctx.lineTo(-s.vx*.065,-s.vy*.065);ctx.lineTo(0,s.r*.6);ctx.fillStyle=color+'55';ctx.fill();if(s.owner==='boss'){ellipse(ctx,0,0,s.r+3,s.r+3,null,color+'88',.8);}}ctx.restore();}
  drawEffects(ctx){for(const e of this.game.effects){const p=1-e.life/e.maxLife;ctx.save();ctx.globalAlpha=clamp(e.life/e.maxLife,0,1);if(e.type==='ring'){ellipse(ctx,e.x,e.y,e.radius*(.2+p*.8),e.radius*(.2+p*.8)*.45,null,e.color,2.5*(1-p)+.5);glow(ctx,e.x,e.y,e.radius,e.color,.1*(1-p));}else if(e.type==='shockwave'){const x=e.x+e.dir*p*e.radius;glow(ctx,x,e.y,40,e.color,.3);path(ctx,[[x-18,e.y],[x-5,e.y-30*(1-p)],[x+8,e.y-12],[x+18,e.y]],e.color+'99',e.color,1);}else if(e.type==='text'){ctx.font=`600 ${e.crit?20:14}px Manrope`;ctx.textAlign='center';ctx.fillStyle=e.color;ctx.shadowColor='#0a1b16';ctx.shadowBlur=4;ctx.fillText(e.text,e.x,e.y-p*38);}else if(e.type==='slash'){ctx.translate(e.x,e.y);ctx.scale(e.dir,1);ctx.beginPath();ctx.arc(0,0,e.radius,-1.2+p*.4,1.2+p*.4);ctx.strokeStyle=e.color;ctx.lineWidth=5*(1-p);ctx.stroke();}ctx.restore();}}
  drawParticles(ctx){for(const p of this.game.particles){ctx.save();ctx.globalAlpha=clamp(p.life/p.maxLife,0,1);if(p.type==='smoke'){ellipse(ctx,p.x,p.y,p.size*(1+(1-p.life/p.maxLife)),p.size*.7,p.color);}else if(p.type==='spark'){line(ctx,p.x,p.y,p.x-p.vx*.025,p.y-p.vy*.025,p.color,p.size);}else{ctx.translate(p.x,p.y);ctx.rotate(p.life*4);ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);}ctx.restore();}}
}
