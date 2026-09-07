import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const screenshotDir = path.resolve('docs/screenshots');

test.beforeAll(async () => { await mkdir(screenshotDir, { recursive: true }); });

async function deterministicBrowser(page: Page) {
  await page.addInitScript(() => {
    let state = 0x12345678;
    try {
      Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: (array: ArrayBufferView): ArrayBufferView => {
        const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let index = 0; index < view.length; index += 1) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; view[index] = state & 0xff; }
        return array;
      } });
    } catch {}
  });
}

function stagePoint(box: { x: number; y: number; width: number; height: number }, point: readonly [number, number]) {
  const scale = Math.min(box.width / 1024, box.height / 768);
  const offsetX = (box.width - 1024 * scale) / 2;
  const offsetY = (box.height - 768 * scale) / 2;
  return { x: box.x + offsetX + point[0] * scale, y: box.y + offsetY + point[1] * scale };
}

async function grow(page: Page, tip: readonly [number, number], screenshotName?: string, shapingScreenshotName?: string) {
  const stage = page.locator('.bouquet-stage'); const box = await stage.boundingBox(); if (!box) throw new Error('Stage is not visible.');
  const seed = stagePoint(box, [512, 620]); const target = stagePoint(box, tip);
  await page.mouse.move(seed.x, seed.y); await page.waitForTimeout(140); await page.mouse.down();
  await page.mouse.move((seed.x + target.x) / 2, (seed.y + target.y) / 2, { steps: 5 });
  await page.mouse.move(target.x, target.y, { steps: 5 });
  if (screenshotName) await page.screenshot({ path: path.join(screenshotDir, screenshotName), animations: 'disabled' });
  await page.mouse.up();
  await expect(stage).toHaveAttribute('data-growth-state', 'shaping');
  await page.mouse.move(target.x, target.y); await page.mouse.down();
  await page.mouse.move(stagePoint(box, [tip[0] + 70, tip[1] - 36]).x, stagePoint(box, [tip[0] + 70, tip[1] - 36]).y, { steps: 5 });
  if (shapingScreenshotName) await page.screenshot({ path: path.join(screenshotDir, shapingScreenshotName), animations: 'disabled' });
  await page.mouse.up();
  await page.waitForTimeout(880);
}

test('pointer creation and export', async ({ page, browser }) => {
  await deterministicBrowser(page); await page.goto('/');
  await expect(page).toHaveScreenshot('landing-1440.png');
  await page.screenshot({ path: path.join(screenshotDir, 'landing-1440x900.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Use my mouse' }).click();
  await grow(page, [420, 275], 'growing-1440x900.png', 'shaping-1440x900.png');
  await page.getByRole('button', { name: 'Wild rose' }).click(); await grow(page, [590, 235]);
  await page.getByRole('button', { name: 'Chamomile' }).click(); await grow(page, [520, 350]);
  await expect(page.getByLabel('Bouquet controls')).toContainText('3 / 7');
  await page.screenshot({ path: path.join(screenshotDir, 'three-settled-1440x900.png'), animations: 'disabled' });

  const stage = page.locator('.bouquet-stage'); const box = await stage.boundingBox(); if (!box) throw new Error('Stage missing.');
  const rose = stagePoint(box, [590, 235]); await page.mouse.click(rose.x, rose.y);
  await expect(page.getByText('Wild rose', { exact: false }).last()).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, 'editing-1440x900.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await page.mouse.move(rose.x, rose.y); await page.mouse.down(); await page.mouse.move(rose.x + 35, rose.y + 20, { steps: 4 }); await page.mouse.up();
  await page.getByRole('button', { name: '↶ Undo' }).click(); await page.getByRole('button', { name: '↷ Redo' }).click();
  await page.getByLabel('To').fill('Mara'); await page.getByLabel('To').blur();
  await page.getByLabel('From').fill('June'); await page.getByLabel('From').blur();
  await page.getByLabel(/A small note/).fill('Hope this makes your desk nicer.'); await page.getByLabel(/A small note/).blur();
  await page.getByRole('button', { name: /Finish bouquet/ }).click();
  await expect(page.getByRole('heading', { name: 'Add a dedication' })).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, 'finish-print-1440x900.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'The formula' }).click();
  const originalFormula = await page.locator('.formula-card').textContent();
  const originalFingerprint = originalFormula?.match(/[a-f0-9]{12}/)?.[0];
  expect(originalFingerprint).toMatch(/^[a-f0-9]{12}$/);

  const recipeDownloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save bouquet file' }).click();
  const recipeDownload = await recipeDownloadPromise; const recipePath = await recipeDownload.path(); expect(recipePath).toBeTruthy();
  const recipe = JSON.parse(await (await import('node:fs/promises')).readFile(recipePath!, 'utf8'));
  expect(recipe.flowers).toHaveLength(3); expect(recipe.geometryVersion).toBe('botanical-v1');

  const svgDownloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save SVG' }).click();
  const svgPath = await (await svgDownloadPromise).path(); const svg = await (await import('node:fs/promises')).readFile(svgPath!, 'utf8');
  expect(svg).not.toMatch(/<script|foreignObject|(?:href|src)=["']https?:/i); expect(svg).not.toMatch(/NaN|Infinity/);

  await page.evaluate(() => { const original = URL.createObjectURL.bind(URL); (window as typeof window & { __lastBlob?: Blob }).__lastBlob = undefined; URL.createObjectURL = (blob: Blob | MediaSource) => { if (blob instanceof Blob) (window as typeof window & { __lastBlob?: Blob }).__lastBlob = blob; return original(blob); }; });
  const pngDownloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save image' }).click(); await pngDownloadPromise;
  const pngInfo = await page.evaluate(async () => {
    const blob = (window as typeof window & { __lastBlob?: Blob }).__lastBlob!; const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0);
    const points = [[0, 0], [1200, 1500], [2399, 2999]];
    let nonPaperSamples = 0;
    for (let y = 150; y < bitmap.height; y += 100) for (let x = 150; x < bitmap.width; x += 100) {
      const pixel = context.getImageData(x, y, 1, 1).data;
      if (Math.abs(pixel[0] - 246) + Math.abs(pixel[1] - 241) + Math.abs(pixel[2] - 231) > 18) nonPaperSamples += 1;
    }
    return { width: bitmap.width, height: bitmap.height, alphas: points.map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]), nonPaperSamples };
  });
  expect(pngInfo.width).toBe(2400); expect(pngInfo.height).toBe(3000); expect(pngInfo.alphas).toEqual([255, 255, 255]); expect(pngInfo.nonPaperSamples).toBeGreaterThan(10);

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const recipientPage = await context.newPage(); await recipientPage.goto('http://127.0.0.1:5173/');
  await recipientPage.locator('input[type=file]').setInputFiles(recipePath!);
  await expect(recipientPage.getByText('Hope this makes your desk nicer.')).toBeVisible();
  await recipientPage.screenshot({ path: path.join(screenshotDir, 'recipient-1440x900.png'), animations: 'disabled' });
  await expect(recipientPage.getByText('Mara', { exact: false }).first()).toBeVisible();
  await recipientPage.getByRole('button', { name: 'The formula' }).click();
  await expect(recipientPage.locator('.formula-card')).toContainText(originalFingerprint!);
  await context.close();
});

test('keyboard creation and export', async ({ page }) => {
  await deterministicBrowser(page); await page.goto('/');
  await page.getByRole('button', { name: 'Use my mouse' }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Keyboard' }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Cosmos', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Wild rose', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (let flower = 0; flower < 3; flower += 1) {
    if (flower === 1) { await page.getByRole('button', { name: 'Wild rose', exact: true }).focus(); await page.keyboard.press('ArrowRight'); }
    if (flower === 2) { await page.getByRole('button', { name: 'Chamomile', exact: true }).focus(); await page.keyboard.press('ArrowRight'); }
    await page.getByRole('button', { name: 'Plant' }).focus(); await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('Enter');
    await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter'); await page.waitForTimeout(880);
  }
  await expect(page.getByLabel('Bouquet controls')).toContainText('3 / 7');
  await page.keyboard.press('Meta+z'); await expect(page.getByLabel('Bouquet controls')).toContainText('2 / 7');
  await page.keyboard.press('Meta+Shift+z'); await expect(page.getByLabel('Bouquet controls')).toContainText('3 / 7');
  await page.getByRole('button', { name: /1\. Wild rose/ }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Move', exact: true }).focus(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Done' }).focus(); await page.keyboard.press('Enter');
  await page.getByLabel('To').focus(); await page.keyboard.type('Rowan'); await page.keyboard.press('Tab');
  await page.getByLabel('From').focus(); await page.keyboard.type('Ash'); await page.keyboard.press('Tab');
  await page.getByLabel(/A small note/).focus(); await page.keyboard.type('A tiny garden for you.'); await page.keyboard.press('Tab');
  await page.getByRole('button', { name: /Finish bouquet/ }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Add a dedication' })).toBeVisible();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save bouquet file' }).focus(); await page.keyboard.press('Enter');
  expect((await download).suggestedFilename()).toMatch(/\.bouquet\.json$/);
});

test('camera denial recovery', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) } }); });
  await page.goto('/'); await page.getByRole('button', { name: 'Grow with my hands' }).click();
  await expect(page.getByText(/permission was declined/i)).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, 'recoverable-error-1440x900.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 1280, height: 800 }); await page.screenshot({ path: path.join(screenshotDir, 'recoverable-error-1280x800.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Use my mouse' }).click(); await expect(page.getByText('Pointer mode')).toBeVisible();
});

test('local hand model loads in camera mode', async ({ page }) => {
  const requests: string[] = []; page.on('request', (request) => requests.push(request.url()));
  await page.goto('/'); await page.getByRole('button', { name: 'Grow with my hands' }).click();
  await expect(page.getByText(/Model ready|Hand found/)).toBeVisible({ timeout: 25_000 });
  await page.screenshot({ path: path.join(screenshotDir, 'camera-setup-1440x900.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 1280, height: 800 }); await page.screenshot({ path: path.join(screenshotDir, 'camera-setup-1280x800.png'), animations: 'disabled' });
  expect(requests.some((url) => url.includes('/generated/hand-worker.js'))).toBe(true);
  expect(requests.some((url) => url.includes('/models/hand_landmarker.task'))).toBe(true);
  expect(requests.filter((url) => /hand-worker|hand_landmarker|vision_wasm/.test(url)).every((url) => new URL(url).hostname === '127.0.0.1')).toBe(true);
  await page.getByRole('button', { name: 'Camera off' }).click();
  await expect(page.getByText(/Camera has not been requested|Preparing hand mode|Camera is off/i).or(page.getByRole('button', { name: 'Grow with my hands' }))).toBeVisible();
});

test('pending camera permission dismissal', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => new Promise(() => undefined) } }); });
  await page.goto('/'); await page.getByRole('button', { name: 'Grow with my hands' }).click();
  await expect(page.getByText(/Waiting for camera permission/)).toBeVisible(); await page.getByRole('button', { name: 'Use my mouse' }).click();
  await page.getByRole('button', { name: 'Archive' }).click(); await expect(page.getByText('No bouquets yet.')).toBeVisible();
});

test('local archive save', async ({ page }) => {
  await deterministicBrowser(page); await page.goto('/'); await page.getByRole('button', { name: 'Use my mouse' }).click();
  await grow(page, [460, 300]);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByRole('heading', { name: 'Untitled bouquet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export recipe' })).toBeVisible();
});

test('storage failure recovery', async ({ page }) => {
  await page.addInitScript(() => {
    const failingIndexedDb = {
      open() {
        const request: { error?: DOMException; onerror?: (event: Event) => void } = {};
        setTimeout(() => {
          request.error = new DOMException('quota unavailable', 'QuotaExceededError');
          request.onerror?.(new Event('error'));
        });
        return request;
      },
    };
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: failingIndexedDb });
  });
  await deterministicBrowser(page); await page.goto('/'); await page.getByRole('button', { name: 'Use my mouse' }).click();
  await grow(page, [460, 300]);
  await expect(page.getByRole('alert')).toContainText('Local save failed. Export a file now.', { timeout: 5_000 });
  await expect(page.getByLabel('Bouquet controls')).toContainText('1 / 7');
  await page.getByRole('button', { name: 'Save a file' }).click();
  await expect(page.getByRole('button', { name: 'Save bouquet file' })).toBeVisible();
});

test('ten clean camera cycles', async ({ page }) => {
  await page.addInitScript(() => {
    const counts = { streams: 0, stoppedTracks: 0, workers: 0, terminatedWorkers: 0, activeTracks: 0 };
    Object.defineProperty(window, '__cameraCycleCounts', { value: counts });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => {
        counts.streams += 1; counts.activeTracks += 1;
        const stream = new MediaStream();
        const track = { readyState: 'live', stop() { if (this.readyState === 'live') { this.readyState = 'ended'; counts.stoppedTracks += 1; counts.activeTracks -= 1; } } };
        Object.defineProperty(stream, 'getTracks', { value: () => [track] });
        return stream;
      },
    } });
    class LocalWorker extends EventTarget {
      constructor() { super(); counts.workers += 1; }
      postMessage(message: { type?: string; sessionId?: number }) {
        if (message.type === 'INIT') setTimeout(() => this.dispatchEvent(new MessageEvent('message', { data: { type: 'READY', sessionId: message.sessionId } })));
      }
      terminate() { counts.terminatedWorkers += 1; }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: LocalWorker });
  });
  await page.goto('/');
  for (let cycle = 0; cycle < 10; cycle += 1) {
    if (cycle > 0) await page.getByRole('button', { name: /Love, Parametrically/ }).click();
    await page.getByRole('button', { name: 'Grow with my hands' }).click();
    await expect(page.getByText(/Model ready/)).toBeVisible();
    await page.getByRole('button', { name: 'Use my mouse' }).click();
    await expect(page.getByText('Pointer mode')).toBeVisible();
  }
  const counts = await page.evaluate(() => (window as typeof window & { __cameraCycleCounts: { streams: number; stoppedTracks: number; workers: number; terminatedWorkers: number; activeTracks: number } }).__cameraCycleCounts);
  expect(counts).toEqual({ streams: 10, stoppedTracks: 10, workers: 10, terminatedWorkers: 10, activeTracks: 0 });
});

test('camera-free recipient view at 1280×800', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(path.resolve('tests/fixtures/bouquet-v1.bouquet.json'));
  await expect(page.getByText('Hope this makes your desk nicer.')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await page.screenshot({ path: path.join(screenshotDir, 'recipient-1280x800.png'), animations: 'disabled' });
});

test('studio views at 1280×800', async ({ page }) => {
  await deterministicBrowser(page); await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('/');
  await page.screenshot({ path: path.join(screenshotDir, 'landing-1280x800.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Use my mouse' }).click();
  await grow(page, [420, 275], 'growing-1280x800.png', 'shaping-1280x800.png');
  await page.getByRole('button', { name: 'Wild rose' }).click(); await grow(page, [590, 235]);
  await page.getByRole('button', { name: 'Chamomile' }).click(); await grow(page, [520, 350]);
  await page.screenshot({ path: path.join(screenshotDir, 'three-settled-1280x800.png'), animations: 'disabled' });
  const box = await page.locator('.bouquet-stage').boundingBox(); if (!box) throw new Error('Stage missing.'); const rose = stagePoint(box, [590, 235]); await page.mouse.click(rose.x, rose.y);
  await page.screenshot({ path: path.join(screenshotDir, 'editing-1280x800.png'), animations: 'disabled' });
  await page.getByRole('button', { name: /Finish bouquet/ }).click();
  await page.screenshot({ path: path.join(screenshotDir, 'finish-print-1280x800.png'), animations: 'disabled' });
});

test('keyboard flow in a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 450 }); await page.goto('/'); await page.getByRole('button', { name: 'Use my mouse' }).click();
  await page.getByRole('button', { name: 'Keyboard' }).click(); await page.getByRole('button', { name: 'Plant' }).click(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await page.waitForTimeout(900);
  const finish = page.getByRole('button', { name: /Finish bouquet/ }); await expect(finish).toBeEnabled(); await finish.click();
  await expect(page.getByRole('button', { name: 'Save image' })).toBeVisible();
  expect((await page.getByRole('button', { name: 'Save image' }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
});
