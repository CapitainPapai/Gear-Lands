import { seeded } from './math.js';

export const ZONES = [
  { id: 0, name: 'Свалка', english: 'THE SCRAPYARD', eyebrow: 'ЗАБЫТЫЕ ОКРАИНЫ · I', subtitle: 'Там, где металл обретает душу', description: 'Место твоего пробуждения. Среди ржавых остовов ещё теплится жизнь.', art: 'scrapyard-panorama.jpg', start: 0, end: 3300, floor: 660, spawn: { x: 460, y: 600 }, bench: { x: 650, y: 660 }, boss: 'scrap', tint: '#ad9466', tracks: [0, 1], battle: 6, requirement: null, secret: { x: 1810, y: 338 } },
  { id: 1, name: 'Заброшенный город', english: 'THE FORSAKEN CITY', eyebrow: 'ПО ГРУДЬ В ПРОШЛОМ · II', subtitle: 'Улицы, забывшие человеческие шаги', description: 'Погасшие фонари, пустые дома и часовщик, который всё ещё ждёт.', art: 'abandoned-city.jpg', start: 3300, end: 6700, floor: 660, spawn: { x: 3380, y: 600 }, bench: { x: 3530, y: 660 }, boss: 'clock', tint: '#b58e64', tracks: [4, 5], battle: 6, requirement: 'scrap', secret: { x: 5070, y: 248 } },
  { id: 2, name: 'Мемориал', english: 'THE MEMORIAL', eyebrow: 'САД ПОСЛЕДНЕЙ ПАМЯТИ · III', subtitle: 'Здесь помнят тех, у кого было сердце', description: 'Сад памяти под сводами собора. Хранительница стережёт последний человеческий голос.', art: 'memorial.jpg', start: 6700, end: 10100, floor: 660, spawn: { x: 6780, y: 600 }, bench: { x: 6960, y: 660 }, boss: 'abbess', tint: '#80b8af', tracks: [8, 9], battle: 6, requirement: 'clock', secret: { x: 8530, y: 248 } },
  { id: 3, name: 'Главный город', english: 'THE GRAND CAPITAL', eyebrow: 'СЕРДЦЕ МЕХАНИЧЕСКОЙ ИМПЕРИИ · IV', subtitle: 'Золото снаружи. Пар и кровь внутри.', description: 'Город имперских механизмов. Поднимись по крышам к вратам цитадели.', art: 'capital.jpg', start: 10100, end: 13500, floor: 660, spawn: { x: 10180, y: 600 }, bench: { x: 10340, y: 660 }, boss: null, tint: '#c4a16b', tracks: [11, 11], battle: 11, requirement: 'abbess', secret: { x: 12140, y: 158 } },
  { id: 4, name: 'Цитадель', english: 'THE CITADEL', eyebrow: 'ПОСЛЕДНЕЕ ВОСХОЖДЕНИЕ · V', subtitle: 'Каждая шестерня приближает к нему', description: 'Вертикальный лабиринт приводов. Реактивное сердце поможет одолеть гравитацию.', art: 'citadel.jpg', start: 13500, end: 16500, floor: 660, spawn: { x: 13580, y: 600 }, bench: { x: 13730, y: 660 }, boss: null, tint: '#b29670', tracks: [12, 12], battle: 12, requirement: 'abbess', secret: { x: 15470, y: -1118 } },
  { id: 5, name: 'Вершина цитадели', english: 'THE CROWN OF GEARS', eyebrow: 'НАД ОБЛАКАМИ · VI', subtitle: 'У всего механизма есть создатель', description: 'Трон под открытым небом. ИмператорGear Lands ждёт того, кто вернулся из небытия.', art: 'summit.jpg', start: 16500, end: 19500, floor: -1740, spawn: { x: 16580, y: -1800 }, bench: { x: 16710, y: -1740 }, boss: 'emperor', tint: '#a5bbc4', tracks: [14, 14], battle: 13, requirement: 'abbess', secret: null },
];
export const BOSSES = {
  scrap: { name: 'Феррум, страж свалки', short: 'Феррум', title: 'ХРАНИТЕЛЬ ВОСТОЧНЫХ ВРАТ', hp: 260, w: 105, h: 133, color: '#c99c64', xp: 200, gears: 120, points: 2, reward: ['dash', 'doubleJump'], relic: 'Поршневые ноги', relicText: 'Паровой рывок [K] и двойной прыжок', zone: 0, arenaMin: 2420, arenaMax: 3200 },
  clock: { name: 'Хронос, слепой часовщик', short: 'Хронос', title: 'ХРАНИТЕЛЬ ПОГАСШИХ ЧАСОВ', hp: 410, w: 86, h: 140, color: '#d2b57b', xp: 300, gears: 180, points: 2, reward: ['wallJump'], relic: 'Магнитные захваты', relicText: 'Прыжки от стен и замедленное скольжение', zone: 1, arenaMin: 5960, arenaMax: 6600 },
  abbess: { name: 'Мнемоза, голос мемориала', short: 'Мнемоза', title: 'ХРАНИТЕЛЬНИЦА ПОСЛЕДНЕЙ ПАМЯТИ', hp: 560, w: 100, h: 148, color: '#9fcebd', xp: 420, gears: 240, points: 3, reward: ['flight'], relic: 'Реактивное сердце', relicText: 'Третий прыжок и парение при удержании пробела', zone: 2, arenaMin: 8600, arenaMax: 10000 },
  emperor: { name: 'Аврелий, император шестерён', short: 'Император', title: 'ВЛАДЫКА GEAR LANDS · ТВОЙ СОЗДАТЕЛЬ', hp: 920, w: 94, h: 156, color: '#dfbd79', xp: 800, gears: 500, points: 3, reward: [], relic: 'Свобода', relicText: 'Империя больше не держит тебя', zone: 5, arenaMin: 17000, arenaMax: 19350 },
};

export function createWorld() {
  const platforms = [], walls = [], enemies = [], hazards = [], decorations = [], memories = [];
  let id = 0;
  const platform = (x, y, w, type = 'iron', zone = 0) => platforms.push({ id: id++, x, y, w, h: type === 'ground' ? 240 : 24, type, zone });
  const enemy = (x, y, type, zone, range = 160) => enemies.push({ id: `e${enemies.length}`, x, y: type === 'sentinel' ? y - 31 : y, spawnX: x, spawnY: type === 'sentinel' ? y - 31 : y, type, zone, range, w: type === 'drone' ? 44 : type === 'sentinel' ? 48 : 46, h: type === 'drone' ? 37 : type === 'sentinel' ? 65 : 34, hp: type === 'sentinel' ? 70 + zone * 10 : type === 'drone' ? 38 + zone * 7 : 42 + zone * 8, dir: -1, vx: 0, vy: 0, timer: 0, attackTimer: 1.4, hit: 0, dead: false, grounded: false });
  for (const z of ZONES) {
    const rng = seeded(410 + z.id * 71);
    if (z.id === 0) {
      platform(0, 660, 2250, 'ground', z.id);
      platform(2380, 660, 920, 'ground', z.id);
      [[880,550,190],[1190,470,170],[1480,395,190],[1740,370,190],[2030,480,170],[2220,565,210]].forEach(p => platform(...p, 'scrap', z.id));
      enemy(1040, 626, 'crawler', z.id, 130); enemy(1510, 626, 'crawler', z.id, 160); enemy(1900, 626, 'sentinel', z.id, 130); enemy(2160, 420, 'drone', z.id, 120); enemy(2530, 626, 'crawler', z.id, 90);
      hazards.push({ x: 2250, y: 735, w: 130, h: 150, type: 'pit', zone: z.id });
    } else if (z.id === 1) {
      [[0,1440],[1560,930],[2630,770]].forEach(([s,w]) => platform(z.start+s,660,w,'ground',z.id));
      [[340,550,190],[660,455,175],[950,365,180],[1250,470,180],[1400,565,210],[1780,545,190],[2020,445,180],[2280,360,170],[1690,330,160],[1970,280,180],[2470,560,230]].forEach(p => platform(z.start+p[0],p[1],p[2],'iron',z.id));
      enemy(z.start+570,626,'crawler',z.id,150); enemy(z.start+1050,626,'sentinel',z.id,160); enemy(z.start+1310,380,'drone',z.id,140); enemy(z.start+1840,626,'crawler',z.id,140); enemy(z.start+2270,310,'drone',z.id,120); enemy(z.start+2810,626,'sentinel',z.id,120);
      hazards.push({x:z.start+1440,y:735,w:120,h:150,type:'pit',zone:z.id},{x:z.start+2490,y:735,w:140,h:150,type:'pit',zone:z.id});
    } else if (z.id === 2) {
      platform(z.start,660,3400,'ground',z.id);
      [[410,550,190],[710,455,200],[1030,365,190],[1340,280,180],[1660,280,230],[1960,390,190],[2220,510,200]].forEach(p=>platform(z.start+p[0],p[1],p[2],'stone',z.id));
      enemy(z.start+620,626,'crawler',z.id,160); enemy(z.start+1120,626,'sentinel',z.id,180); enemy(z.start+1510,230,'drone',z.id,150); enemy(z.start+1940,626,'sentinel',z.id,130); enemy(z.start+2300,400,'drone',z.id,150); enemy(z.start+2540,626,'crawler',z.id,110);
      hazards.push({x:z.start+830,y:642,w:65,h:18,type:'steam',zone:z.id,phase:0},{x:z.start+2140,y:642,w:65,h:18,type:'steam',zone:z.id,phase:2});
    } else if (z.id === 3) {
      platform(z.start,660,3400,'ground',z.id);
      [[410,550,200],[730,455,190],[1040,365,200],[1360,280,190],[1670,190,220],[1970,190,250],[2250,290,180],[2490,405,180],[2750,510,180],[2970,440,170],[3170,350,180]].forEach(p=>platform(z.start+p[0],p[1],p[2],'capital',z.id));
      enemy(z.start+580,626,'sentinel',z.id,160); enemy(z.start+1110,626,'sentinel',z.id,150); enemy(z.start+1510,220,'drone',z.id,160); enemy(z.start+1930,626,'sentinel',z.id,130); enemy(z.start+2350,230,'drone',z.id,150); enemy(z.start+2790,626,'sentinel',z.id,120); enemy(z.start+3090,300,'drone',z.id,90);
      hazards.push({x:z.start+850,y:642,w:70,h:18,type:'steam',zone:z.id,phase:1},{x:z.start+2430,y:642,w:70,h:18,type:'steam',zone:z.id,phase:3});
    } else if (z.id === 4) {
      platform(z.start,660,2100,'ground',z.id);
      hazards.push({x:z.start+2100,y:735,w:900,h:150,type:'pit',zone:z.id});
      [[390,550,210],[710,445,210],[1040,340,220],[1370,235,210],[1690,130,230]].forEach(p=>platform(z.start+p[0],p[1],p[2],'citadel',z.id));
      // A continuous 2,400-unit climb. Each rise is within double-jump reach.
      for (let i=0; i<22; i++) {
        const x = z.start + 1830 + (i % 2 === 0 ? 0 : 345);
        const y = 20 - i * 110;
        platform(x,y,285,'citadel',z.id);
        if (i % 4 === 1) enemy(x+130,y-55,'drone',z.id,110);
        if (i % 5 === 2) hazards.push({x:x+210,y:y-18,w:55,h:18,type:'steam',zone:z.id,phase:i*.7});
      }
      platform(z.start+2140,-540,270,'checkpoint',z.id);
      platform(z.start+2175,-1090,270,'checkpoint',z.id);
      platform(z.start+2130,-1740,870,'ground',z.id);
      // Leave the lower approach open: the left pilaster starts above the entry ledge.
      walls.push({x:z.start+1775,y:-1740,w:30,h:1610,type:'wall'},{x:z.start+2490,y:-1740,w:30,h:1740,type:'wall'});
      enemy(z.start+610,626,'sentinel',z.id,140); enemy(z.start+1220,275,'drone',z.id,120); enemy(z.start+1620,626,'sentinel',z.id,130);
    } else {
      platform(z.start,-1740,3000,'ground',z.id);
      platform(z.start+720,-1850,180,'capital',z.id);
      platform(z.start+2080,-1850,180,'capital',z.id);
      enemy(z.start+580,-1774,'sentinel',z.id,120); enemy(z.start+880,-1920,'drone',z.id,110);
    }
    if (z.secret) memories.push({ id: `memory-${z.id}`, x: z.secret.x, y: z.secret.y, zone: z.id, collected: false });
    for (let x=z.start+160; x<z.end-150; x+=180+rng()*160) {
      decorations.push({x,y:z.floor,type:z.id===0?'scrap':z.id===2?'flowers':z.id===4?'pipes':'lamp',scale:.6+rng()*.65,seed:rng()*100,zone:z.id});
    }
    // Small trails of collectible cogs teach the route without waypoint clutter.
    for (const p of platforms.filter(p=>p.zone===z.id && p.type!=='ground').slice(0,8)) {
      for (let j=0;j<3;j++) decorations.push({x:p.x+35+j*35,y:p.y-34,type:'cog',value:3,collected:false,zone:z.id,seed:rng()*6});
    }
  }
  const bosses = Object.entries(BOSSES).map(([key,b])=> {
    const z=ZONES[b.zone];
    return { id:key,...b,x:z.end-(key==='emperor'?780:520),y:z.floor-b.h,spawnX:z.end-(key==='emperor'?780:520),spawnY:z.floor-b.h,maxHp:b.hp,dir:-1,vx:0,vy:0,grounded:true,active:false,dead:false,hit:0,state:'idle',timer:1.8,attackIndex:0,phase:1,invuln:0 };
  });
  const gates = ZONES.filter(z=>z.requirement).map(z=>({x:z.start-25,y:z.floor-1600,w:28,h:z.id===5?4200:1800,zone:z.id,requirement:z.requirement}));
  const benches = ZONES.map(z=>({...z.bench,id:`bench-${z.id}`,zone:z.id,discovered:z.id===0}));
  benches.push({x:15775,y:-540,id:'bench-4-mid',zone:4,discovered:false},{x:15810,y:-1090,id:'bench-4-high',zone:4,discovered:false});
  return { platforms, walls, enemies, bosses, hazards, decorations, memories, gates, benches };
}
export function zoneAt(x) { return ZONES.find(z=>x>=z.start && x<z.end) || (x<0?ZONES[0]:ZONES[5]); }
export function floorAt(x) { return zoneAt(x).floor; }
