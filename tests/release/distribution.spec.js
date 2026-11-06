import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const standalone = pathToFileURL(fileURLToPath(new URL('../../index.html', import.meta.url))).href;
const pages = 'http://127.0.0.1:4174/Gear-Lands/';

function monitor(page, errors, requests) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
}

async function playAndCheck(page) {
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
  await expect(page.locator('#start-button')).toBeVisible();
  await page.click('#start-button');
  await expect.poll(() => page.evaluate(() => window.__GEAR_LANDS__.state.started)).toBe(true);
  const before = await page.evaluate(() => window.__GEAR_LANDS__.state.player.x);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(450); await page.keyboard.up('KeyD');
  expect(await page.evaluate(() => window.__GEAR_LANDS__.state.player.x)).toBeGreaterThan(before + 50);
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-skill]')).toHaveCount(48);
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyM');
  await expect(page.locator('[data-location]')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await page.click('#music-button');
  await expect(page.locator('[data-track]')).toHaveCount(15);
  await page.click('[data-track="8"]');
  await expect(page.locator('#current-track')).toHaveText('Сад памяти');
  await expect.poll(() => page.evaluate(() => window.__GEAR_LANDS__.state.sound)).toBe(true);
  await page.keyboard.press('Escape');
}

test('root index.html plays from file:// with graphics, music and saves, without network or a server', async ({ page }) => {
  const errors = [], requests = [];
  await page.addInitScript(() => { try { localStorage.setItem('gear-lands-settings', JSON.stringify({ sound: false })); } catch {} });
  monitor(page, errors, requests);
  await page.goto(standalone);
  await playAndCheck(page);
  expect(requests.filter(url => /^https?:/i.test(url))).toEqual([]);
  expect(errors).toEqual([]);
  const embedded = await page.evaluate(() => ({
    panoramas: Object.keys(globalThis.__GEAR_LANDS_EMBEDDED__.assets).length,
    tracks: globalThis.__GEAR_LANDS_EMBEDDED__.manifest.tracks.length,
    audio: Object.keys(globalThis.__GEAR_LANDS_EMBEDDED__.audio).length,
    loadedImages: document.querySelectorAll('.location-card-art').length,
  }));
  // The atlas was closed above; payload counts are the authoritative check.
  expect(embedded.panoramas).toBe(6); expect(embedded.tracks).toBe(15); expect(embedded.audio).toBe(29);
  await page.click('#settings-button');
  await page.click('[data-save]');
  await expect(page.locator('#save-status')).toContainText('Путь сохранён');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('#loading-screen')).toBeHidden();
  await expect(page.locator('#start-button')).toContainText('Продолжить путь');
  expect(errors).toEqual([]);
});

test('production dist works below /Gear-Lands/ and every asset URL stays relative', async ({ page }) => {
  const errors = [], requests = [], failures = [];
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => localStorage.setItem('gear-lands-settings', JSON.stringify({ sound: false })));
  monitor(page, errors, requests);
  await page.goto(pages);
  await playAndCheck(page);
  expect(failures).toEqual([]); expect(errors).toEqual([]);
  expect(requests.some(url => url.endsWith('/Gear-Lands/audio/manifest.json'))).toBe(true);
  expect(requests.some(url => url.endsWith('/Gear-Lands/audio/09.ogg'))).toBe(true);
  expect(requests.filter(url => /^https?:/i.test(url)).every(url => new URL(url).pathname.startsWith('/Gear-Lands/'))).toBe(true);
  expect(existsSync(fileURLToPath(new URL('../../dist/.nojekyll', import.meta.url)))).toBe(true);
  const html = readFileSync(fileURLToPath(new URL('../../dist/index.html', import.meta.url)), 'utf8');
  expect(html).not.toMatch(/(?:src|href)="\/(?:assets|art|audio)\//);
});
