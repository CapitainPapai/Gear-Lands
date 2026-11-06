import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, SKILL_BY_ID, computeStats, canLearn, CORE_SKILLS } from '../src/game/skills.js';
import { xpForLevel } from '../src/game/math.js';

test('the tree has 48 unique, valid nodes across four branches', () => {
  assert.equal(SKILLS.length, 48);
  assert.equal(new Set(SKILLS.map(s => s.id)).size, 48);
  assert.equal(new Set(SKILLS.map(s => s.branch)).size, 4);
  for (const skill of SKILLS) {
    assert.ok(skill.cost > 0);
    assert.ok(skill.description.length > 5);
    for (const id of skill.requires) assert.ok(SKILL_BY_ID[id], `missing prerequisite ${id}`);
  }
});
test('prerequisites and point costs are enforced', () => {
  const dash = SKILL_BY_ID['mech-0'];
  const double = SKILL_BY_ID['mech-1'];
  const tank = SKILL_BY_ID['mech-2'];
  assert.equal(canLearn(dash, [], 1), true);
  assert.equal(canLearn(dash, [], 0), false);
  assert.equal(canLearn(tank, [], 5), false);
  assert.equal(canLearn(tank, ['mech-0'], 1), true);
  assert.equal(canLearn(dash, ['mech-0'], 5), false);
  assert.equal(canLearn(double, [], 1), true);
});
test('every advertised stat bonus changes the simulation stats', () => {
  const base = computeStats([], { hp: 0, damage: 0, energy: 0 });
  for (const skill of SKILLS) {
    const next = computeStats([skill.id], { hp: 0, damage: 0, energy: 0 });
    for (const key of Object.keys(skill.effect)) assert.notEqual(next[key], base[key], `${skill.id}: ${key}`);
  }
  assert.equal(computeStats(Object.values(CORE_SKILLS)).maxJumps, 3);
  assert.equal(computeStats(['mech-0']).dash, 1);
  assert.equal(computeStats([], { hp: 2, damage: 3, energy: 1 }).hp, 7);
});
test('experience requirements grow monotonically', () => {
  for (let i = 1; i < 50; i++) assert.ok(xpForLevel(i + 1) > xpForLevel(i));
});
