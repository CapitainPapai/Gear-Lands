import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, BOSSES, createWorld, zoneAt } from '../src/game/world.js';
import { moveAndCollide, overlaps } from '../src/game/math.js';
import { readFileSync, existsSync } from 'node:fs';

test('six contiguous locations, three guardians and an emperor', () => {
  assert.equal(ZONES.length, 6);
  for (let i = 1; i < ZONES.length; i++) assert.equal(ZONES[i].start, ZONES[i - 1].end);
  assert.equal(Object.keys(BOSSES).length, 4);
  assert.deepEqual(ZONES.filter(z => z.boss && z.boss !== 'emperor').map(z => z.boss), ['scrap', 'clock', 'abbess']);
  assert.equal(zoneAt(15000).id, 4);
  assert.equal(zoneAt(18000).id, 5);
});
test('world has reachable checkpoints, secrets, enemies and a vertical citadel', () => {
  const world = createWorld();
  assert.ok(world.enemies.length >= 30);
  assert.equal(world.memories.length, 5);
  assert.ok(world.benches.length >= 8);
  const climb = world.platforms.filter(p => p.zone === 4 && p.type === 'citadel').sort((a, b) => b.y - a.y);
  for (let i = 1; i < climb.length; i++) assert.ok(climb[i - 1].y - climb[i].y <= 130);
  assert.ok(Math.min(...climb.map(p => p.y)) < -1740);
  for (const e of world.enemies.filter(e => e.type !== 'drone')) {
    assert.ok(world.platforms.some(p => e.x + e.w > p.x && e.x < p.x + p.w && Math.abs(e.y + e.h - p.y) < 10), `${e.id} spawns above a platform`);
  }
});
test('one-way platform collision lands from above and permits jumping through', () => {
  const platforms = [{ x: 0, y: 100, w: 200, h: 20 }];
  const body = { x: 50, y: 30, w: 30, h: 62, vx: 0, vy: 200, grounded: false };
  moveAndCollide(body, platforms, .1);
  assert.equal(body.y, 38); assert.equal(body.grounded, true);
  body.y = 120; body.vy = -500;
  moveAndCollide(body, platforms, .1);
  assert.equal(body.grounded, false); assert.ok(body.y < 120);
});
test('solid walls block horizontal motion', () => {
  const body = { x: 10, y: 20, w: 30, h: 62, vx: 300, vy: 0 };
  moveAndCollide(body, [], .1, [{ x: 50, y: 0, w: 20, h: 200 }]);
  assert.equal(body.x, 20); assert.equal(body.vx, 0);
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
});
test('all fifteen original stereo tracks and fourteen effects are shipped', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/audio/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.tracks.length, 15);
  assert.equal(new Set(manifest.tracks.map(t => t.name)).size, 15);
  for (const t of manifest.tracks) { assert.ok(t.duration >= 30); assert.ok(existsSync(new URL(`../public/audio/${t.file}`, import.meta.url))); }
  assert.equal(Object.keys(manifest.effects).length, 14);
  for (const file of Object.values(manifest.effects)) assert.ok(existsSync(new URL(`../public/audio/${file}`, import.meta.url)));
});
