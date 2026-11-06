import { test, expect } from '@playwright/test';
import fs from 'node:fs';

async function boot(page) {
  await page.addInitScript(() => localStorage.setItem('gear-lands-settings', JSON.stringify({ sound: false })));
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden();
}
async function capture(page, name) {
  await page.waitForTimeout(350);
  const cdp = await page.context().newCDPSession(page);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync(`artifacts/${name}.png`, Buffer.from(shot.data, 'base64'));
  await cdp.detach();
}

test('awakening, movement, jumping, combat and persistent skills', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page);
  await expect(page.locator('#start-button')).toBeVisible();
  await capture(page, 'desktop-intro');
  await page.click('#start-button');
  await expect.poll(() => page.evaluate(() => window.__GEAR_LANDS__.state.started)).toBe(true);
  const before = await page.evaluate(() => window.__GEAR_LANDS__.state.player.x);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(450); await page.keyboard.up('KeyD');
  const after = await page.evaluate(() => window.__GEAR_LANDS__.state.player.x);
  expect(after).toBeGreaterThan(before + 60);
  await page.keyboard.press('Space'); await page.waitForTimeout(140);
  expect(await page.evaluate(() => window.__GEAR_LANDS__.state.player.y)).toBeLessThan(580);
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-skill]')).toHaveCount(48);
  await page.click('[data-skill="mech-0"]');
  await page.click('[data-learn="mech-0"]');
  await expect(page.locator('.detail-status')).toContainText('встроен');
  await capture(page, 'skill-tree');
  await page.keyboard.press('Escape');
  const learned = await page.evaluate(() => window.__GEAR_LANDS__.state.learned);
  expect(learned).toContain('mech-0');
  await page.reload(); await expect(page.locator('#loading-screen')).toBeHidden();
  expect(await page.evaluate(() => window.__GEAR_LANDS__.state.learned)).toContain('mech-0');
  await page.click('#start-button');
  const combat = await page.evaluate(() => {
    const g = window.__GEAR_LANDS_DEV__; g.player.invuln = 2;
    const e = g.world.enemies.find(e => e.type === 'crawler');
    g.player.x = e.x - 65; g.player.y = e.y + e.h - 62; g.player.facing = 1; g.player.attackCooldown = 0; g.player.dashTimer = 0;
    const hp = e.hp; g.action('attack'); return { before: hp, after: e.hp };
  });
  expect(combat.after).toBeLessThan(combat.before);
  expect(errors).toEqual([]);
});

test('guardian rewards open traversal abilities and the atlas has six regions', async ({ page }) => {
  await boot(page); await page.click('#start-button');
  await page.evaluate(() => { const g = window.__GEAR_LANDS_DEV__; g.damageEnemy(g.world.bosses[0], 9999); });
  await expect(page.locator('.victory-content')).toBeVisible();
  const state = await page.evaluate(() => window.__GEAR_LANDS__.state);
  expect(state.defeated).toContain('scrap'); expect(state.learned).toContain('mech-0'); expect(state.learned).toContain('mech-1');
  await page.keyboard.press('Escape'); await page.keyboard.press('KeyM');
  await expect(page.locator('[data-location]')).toHaveCount(6);
  await capture(page, 'world-atlas');
  await page.click('[data-location="4"]');
  await expect(page.locator('#modal-title')).toContainText('Цитадель');
  await expect(page.locator('[data-travel="4"]')).toBeDisabled();
});

test('soundtrack exposes fifteen playable original themes', async ({ page }) => {
  await boot(page); await page.click('#music-button');
  await expect(page.locator('[data-track]')).toHaveCount(15);
  await page.click('[data-track="8"]');
  await expect(page.locator('#current-track')).toHaveText('Сад памяти');
  await expect.poll(() => page.evaluate(() => window.__GEAR_LANDS__.state.sound)).toBe(true);
  await capture(page, 'soundtrack');
  await page.click('[data-ambient]');
  await page.keyboard.press('Escape');
});

test('death returns to a checkpoint without deleting skills', async ({ page }) => {
  await boot(page); await page.click('#start-button');
  await page.evaluate(() => { const g = window.__GEAR_LANDS_DEV__; g.learn('body-0'); g.hurt(999, true); });
  await expect(page.locator('.death-overlay')).toBeVisible();
  await page.click('#respawn-button');
  await expect(page.locator('.death-overlay')).toHaveCount(0);
  const state = await page.evaluate(() => window.__GEAR_LANDS__.state);
  expect(state.learned).toContain('body-0'); expect(state.player.hp).toBe(6); expect(state.paused).toBe(false);
});

test('mobile layout and touch controls remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page); await page.click('#start-button');
  await expect(page.locator('#touch-controls')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, 'mobile');
  await page.click('#nav-skills'); await expect(page.locator('[data-skill]')).toHaveCount(48);
  await capture(page, 'mobile-skills');
});

test('all boss attack cycles run and the emperor can be defeated', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page); await page.click('#start-button');
  const result = await page.evaluate(() => {
    const g = window.__GEAR_LANDS_DEV__; g.paused = true;
    const report = [];
    for (const b of g.world.bosses) {
      b.dead = false; b.hp = b.maxHp; b.active = true; b.state = 'idle'; b.timer = .1; b.phase = 1; b.attackIndex = 0;
      g.zone = { id: b.zone, start: b.spawnX - 500, end: b.spawnX + 900, floor: b.spawnY + b.h };
      g.player.x = b.x - 100; g.player.y = b.spawnY + b.h - 62; g.player.vx = 0; g.player.vy = 0;
      const kinds = new Set();
      for (let i = 0; i < 1500; i++) {
        g.player.invuln = 2; g.player.hp = g.stats.hp;
        g.player.x = b.x - 90; g.player.y = b.spawnY + b.h - 62;
        g.update(1 / 60);
        if (b.attackKind) kinds.add(b.attackKind);
      }
      report.push({ id: b.id, attacks: [...kinds], projectiles: g.projectiles.length });
      if (b.id === 'emperor') {
        g.damageEnemy(b, b.maxHp * .4); b.state = 'transition'; b.timer = 0; g.update(.02);
        g.damageEnemy(b, b.maxHp * .35); b.state = 'transition'; b.timer = 0; g.update(.02);
      }
      g.damageEnemy(b, 99999);
    }
    return { report, defeated: g.defeated, victory: g.victory };
  });
  expect(result.defeated).toEqual(['scrap', 'clock', 'abbess', 'emperor']);
  expect(result.victory).toBe(true);
  for (const boss of result.report) expect(boss.attacks.length).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});

test('citadel checkpoint renders vertically and the summit minimap is populated', async ({ page }) => {
  await boot(page); await page.click('#start-button');
  await page.evaluate(() => {
    const g = window.__GEAR_LANDS_DEV__;
    g.defeated = ['scrap', 'clock', 'abbess']; g.world.bosses.forEach(b => { if (b.id !== 'emperor') b.dead = true; });
    g.player.x = 15720; g.player.y = -1152; g.player.invuln = 10; g.camera.y = -1550;
  });
  await expect.poll(() => page.evaluate(() => window.__GEAR_LANDS__.state.zone)).toBe(4);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__GEAR_LANDS_DEV__.camera.y)).toBeLessThan(-600);
  await capture(page, 'citadel-checkpoint');
  await page.evaluate(() => { const g = window.__GEAR_LANDS_DEV__; g.player.x = 17800; g.player.y = -1802; g.player.invuln = 10; g.camera.y = -2100; });
  await expect.poll(() => page.evaluate(() => window.__GEAR_LANDS__.state.zone)).toBe(5);
  const pixels = await page.evaluate(() => { const c = document.getElementById('minimap'); return [...c.getContext('2d').getImageData(0, 0, c.width, c.height).data].filter((v, i) => i % 4 === 3 && v > 0).length; });
  expect(pixels).toBeGreaterThan(100);
});
