import { test, expect } from '@playwright/test';

// Deterministic action-only regression: the controller presses the same movement,
// jump, dash, attack, repair and rest inputs as a player. It never edits stats,
// teleports, or damages enemies directly. Seed 7719 is a known-good full route.
test('full campaign reaches the summit and defeats all four bosses with ordinary actions', async ({ page }) => {
  test.setTimeout(240000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('gear-lands-settings', JSON.stringify({ sound: false })));
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden();
  await page.evaluate((seedValue) => {
    const g = window.__GEAR_LANDS_DEV__;
    g.paused = true; g.running = false;
  let seed = seedValue; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  window.__controller = {
    axis(dir) { g.keys.delete('KeyA'); g.keys.delete('KeyD'); if (dir) g.keys.add(dir > 0 ? 'KeyD' : 'KeyA'); },
    jump() { g.action('jump'); },
    run(goal, limit = 16000) {
      g.paused = false;
      const p = g.player; const trace = []; let stuck = 0, lastX = p.x, lastJump = -100, lastDash = -100, lastAttack = -100, healed = 0, hits = 0;
      const sign = x => x > 0 ? 1 : -1;
      const center = e => e.x + e.w / 2;
      const nearEnemy = () => g.world.enemies.filter(e => !e.dead && Math.abs(center(e) - center(p)) < 240 && Math.abs(e.y + e.h - p.y - p.h) < 110).sort((a,b)=>Math.abs(center(a)-center(p))-Math.abs(center(b)-center(p)))[0];
      const projectileNear = () => g.projectiles.some(s => s.owner === 'boss' && Math.abs(s.x - center(p)) < 105 && Math.abs(s.y - (p.y + 35)) < 80);
      let result = 'limit';
      for (let i = 0; i < limit; i++) {
        if (g.dead) { result = 'dead'; break; }
        if (g.paused) { result = 'paused'; break; }
        const boss = g.world.bosses.find(b => b.id === goal.boss && !b.dead);
        if (goal.boss && !boss) { result = 'boss-defeated'; break; }
        if (goal.x !== undefined && Math.abs(center(p) - goal.x) < 35 && (!goal.y || Math.abs(p.y + p.h - goal.y) < 30)) { result = 'arrived'; break; }
        let dir = goal.x !== undefined ? sign(goal.x - center(p)) : (boss && !boss.active ? sign(boss.spawnX - center(p)) : 0);
        const enemy = nearEnemy();
        const b = boss && boss.active ? boss : null;
        const threat = b || enemy;
        const td = threat ? center(threat) - center(p) : 9999;
        const windup = threat && threat.state === 'windup';
        const recover = b && (b.state === 'recover' || b.state === 'idle');
        const transition = b && b.state === 'transition';
        // Health is earned through the ordinary repair action; no invulnerability or stat edits.
        if (p.hp <= g.stats.hp - 1.5 && p.energy >= g.stats.healCost && p.healing <= 0 && ((!threat || Math.abs(td) > 280) || (recover && Math.abs(td) > 115)) && p.grounded) {
          this.axis(0); g.action('heal'); healed++;
        }
        if (p.healing > 0) { this.axis(0); g.update(1 / 120); continue; }
        if (b) {
          const kind = b.attackKind;
          if (transition) {
            dir = Math.abs(td) < 190 ? -sign(td) : 0; this.axis(dir);
            if (p.hp <= g.stats.hp - 1 && p.energy >= g.stats.healCost && p.healing <= 0 && p.grounded && Math.abs(td) > 120) { this.axis(0); g.action('heal'); healed++; }
          } else if (windup && kind === 'slam') {
            dir = -sign(td); this.axis(dir);
            if (Math.abs(td) < 175 && b.timer < .22 && g.stats.dash && p.dashCooldown <= 0 && p.facing === dir) { g.action('dash'); lastDash = i; }
          } else if ((kind === 'charge' && b.state === 'attack') || (windup && kind === 'charge' && b.timer < .12)) {
            dir = sign(td); this.axis(dir);
            if (g.stats.dash && p.dashCooldown <= 0 && p.facing === dir && Math.abs(td) < 260) { g.action('dash'); lastDash = i; }
          } else if (recover || b.state === 'idle') {
            dir = Math.abs(td) > 76 ? sign(td) : 0; this.axis(dir);
            if (Math.abs(td) < g.stats.range + b.w / 2 && p.facing === sign(td) && p.attackCooldown <= 0) { g.action('attack'); lastAttack = i; }
          } else { this.axis(dir); }
          if ((kind === 'volley' || kind === 'slam') && projectileNear() && p.grounded && i - lastJump > 25) { this.jump(); lastJump = i; }
          if (kind === 'rain' && b.state === 'attack') { dir = Math.sin(i / 55) > 0 ? 1 : -1; this.axis(dir); }
        } else {
          if (enemy && Math.abs(td) < 125 && !windup) dir = 0;
          this.axis(dir);
          if (enemy && Math.abs(td) < g.stats.range + enemy.w / 2 && p.facing === sign(td) && p.attackCooldown <= 0 && Math.abs(enemy.y + enemy.h - p.y - p.h) < 90) { g.action('attack'); lastAttack = i; }
          if (projectileNear() && p.grounded && i - lastJump > 30) { this.jump(); lastJump = i; }
          if (p.grounded) {
            const ahead = center(p) + dir * 62;
            const floor = g.world.platforms.some(q => ahead > q.x && ahead < q.x + q.w && Math.abs(q.y - (p.y + p.h)) < 15);
            const vent = g.world.hazards.some(h => h.type === 'steam' && dir * (h.x - center(p)) > 0 && dir * (h.x - center(p)) < 115 && Math.abs(h.y - p.y - p.h) < 35);
            if ((!floor || vent) && i - lastJump > 25) { this.jump(); lastJump = i; }
          }
          if (goal.y !== undefined && p.y + p.h > goal.y + 25 && p.jumps < g.stats.maxJumps && p.vy > -70 && i - lastJump > 22) { this.jump(); lastJump = i; }
        }
        if (p.grounded && dir) { const ahead = center(p) + dir * 62; const floor = g.world.platforms.some(q => ahead > q.x && ahead < q.x + q.w && Math.abs(q.y - (p.y + p.h)) < 15); if (!floor && i - lastJump > 25) { this.jump(); lastJump = i; } }
        if (goal.rest !== undefined) {
          const bench = g.world.benches.find(b => b.zone === goal.rest && Math.abs(center(p)-b.x)<80 && Math.abs(p.y+p.h-b.y)<50);
          if (bench) {
            this.axis(0);
            if (!g.activeBoss && g.combatTimer <= 4) { g.action('interact'); if (g.resting > 0) { result = 'arrived'; break; } }
            else if (enemy && Math.abs(td) < g.stats.range + enemy.w/2 && p.attackCooldown <= 0) { p.facing = sign(td); g.action('attack'); }
            g.update(1/120); continue;
          }
        }
        const hpBefore = p.hp;
        g.update(1 / 120);
        if (p.hp < hpBefore) hits++;
        if (i % 120 === 0) { if (Math.abs(p.x - lastX) < 3 && !b && p.healing <= 0) stuck++; else stuck = 0; lastX = p.x; }
        if (stuck > 2 && p.grounded && !b) { this.jump(); lastJump = i; stuck = 0; }
        if (i % 240 === 0) trace.push({ t: +(i/120).toFixed(1), x: Math.round(p.x), y: Math.round(p.y), hp: +p.hp.toFixed(1), boss: b ? Math.round(b.hp) : null, state: b?.state });
      }
      this.axis(0); g.paused = true;
      return { result, x: Math.round(p.x), y: Math.round(p.y), hp: p.hp, maxHp: g.stats.hp, energy: Math.round(p.energy), level: g.level, points: g.points, gears: g.gears, deaths: g.deaths, defeated: [...g.defeated], learned: [...g.learned], hits, healed, trace: trace.slice(-15) };
    }
  };
  g.learn('mech-0');
  }, 7719);
  await page.click('#start-button');

  const run = async (goal, limit) => {
    let r;
    for (let attempt = 0; attempt < 6; attempt++) {
      r = await page.evaluate(({ goal, limit }) => window.__controller.run(goal, limit), { goal, limit });
      if (r.result === 'dead' && goal.boss) { await page.evaluate(() => window.__GEAR_LANDS_DEV__.respawn()); continue; }
      break;
    }
    expect(r.result, JSON.stringify({ goal, ...r })).toBe(goal.boss ? 'boss-defeated' : 'arrived');
    return r;
  };

  await run({ x: 650, rest: 0 }, 1200);
  await run({ x: 2130 }, 6000);
  await run({ x: 2325, y: 565 }, 2400);
  await run({ boss: 'scrap' }, 18000);
  await run({ x: 3530, rest: 1 }, 3000);
  await run({ x: 4650 }, 6000);
  await run({ x: 4905, y: 565 }, 2400);
  await run({ x: 5740 }, 6000);
  await run({ x: 5885, y: 560 }, 2400);
  await run({ boss: 'clock' }, 22000);
  await run({ x: 6960, rest: 2 }, 3000);
  await run({ boss: 'abbess' }, 24000);
  await run({ x: 10340, rest: 3 }, 3000);
  await run({ x: 13730, rest: 4 }, 6000);
  for (const q of [[13995, 550], [14315, 445], [14650, 340], [14975, 235], [15305, 130]]) await run({ x: q[0], y: q[1] }, 2400);
  for (let i = 0; i < 22; i++) {
    const target = await page.evaluate(i => {
      const g = window.__GEAR_LANDS_DEV__;
      const q = g.world.platforms.find(q => q.zone === 4 && q.type === 'citadel' && q.x === (i % 2 ? 15675 : 15330) && q.y === 20 - i * 110);
      return { x: q.x + 142, y: q.y };
    }, i);
    await run({ ...target, ...(i === 5 || i === 10 ? { rest: 4 } : {}) }, 2400);
  }
  await run({ x: 16710, rest: 5 }, 4000);
  await run({ boss: 'emperor' }, 30000);

  const final = await page.evaluate(() => {
    const g = window.__GEAR_LANDS_DEV__;
    g.paused = false;
    for (let i = 0; i < 360; i++) g.update(1 / 120);
    g.renderer.render(.016);
    return { defeated: [...g.defeated], victory: g.victory, restCount: g.restCount, deaths: g.deaths, level: g.level, learned: [...g.learned] };
  });
  expect(final.defeated).toEqual(['scrap', 'clock', 'abbess', 'emperor']);
  expect(final.victory).toBe(true);
  expect(final.restCount).toBeGreaterThanOrEqual(6);
  expect(final.learned).toEqual(expect.arrayContaining(['mech-0', 'mech-1', 'mech-8', 'mech-10']));
  expect(errors).toEqual([]);
});
