import { test, expect } from '@playwright/test';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

let server: ChildProcess;
let root: string;
const origin = 'http://127.0.0.1:4197';

test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'love-parametrically-nested-'));
  const nested = path.join(root, 'love-parametrically'); await mkdir(nested); await cp(path.resolve('dist'), nested, { recursive: true });
  server = spawn(process.execPath, ['scripts/server.mjs', '--root', root, '--port', '4197'], { cwd: path.resolve('.'), stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Nested release server did not start.')), 10_000);
    server.stdout?.on('data', (chunk) => { if (String(chunk).includes('available at')) { clearTimeout(timeout); resolve(); } });
    server.on('exit', (code) => reject(new Error(`Nested release server exited with ${code}`)));
  });
});

test.afterAll(async () => {
  server?.kill('SIGTERM');
  if (root) await rm(root, { recursive: true, force: true });
});

test('nested static path', async ({ page }) => {
  const runtimeRequests: string[] = []; page.on('request', (request) => runtimeRequests.push(request.url()));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4197)/, (route) => route.abort());
  await page.goto(`${origin}/love-parametrically/`);
  await expect(page.getByRole('heading', { name: /A small bouquet/ })).toBeVisible();
  await page.getByRole('button', { name: 'Grow with my hands' }).click();
  await expect(page.getByText(/Model ready|Hand found/)).toBeVisible({ timeout: 25_000 });
  expect(runtimeRequests.some((url) => url === `${origin}/love-parametrically/generated/hand-worker.js`)).toBe(true);
  expect(runtimeRequests.some((url) => url === `${origin}/love-parametrically/models/hand_landmarker.task`)).toBe(true);
  await page.getByRole('button', { name: 'Use my mouse' }).click();
  await page.getByRole('button', { name: 'Keyboard' }).click(); await page.getByRole('button', { name: 'Plant' }).click(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await page.waitForTimeout(900);
  await page.getByRole('button', { name: /Finish bouquet/ }).click(); await expect(page.getByRole('button', { name: 'Save bouquet file' })).toBeVisible();
  expect(runtimeRequests.filter((url) => url.startsWith('http')).every((url) => new URL(url).hostname === '127.0.0.1')).toBe(true);
});

test('loopback server rules', async ({ request }) => {
  const wasm = await request.head(`${origin}/love-parametrically/wasm/vision_wasm_internal.wasm`); expect(wasm.status()).toBe(200); expect(wasm.headers()['content-type']).toBe('application/wasm');
  const manifest = await request.get(`${origin}/love-parametrically/version-manifest.json`); expect(manifest.headers()['cache-control']).toBe('no-cache');
  const post = await request.post(`${origin}/love-parametrically/`); expect(post.status()).toBe(405);
  const traversal = await request.get(`${origin}/love-parametrically/%2e%2e%2fserver.mjs`); expect(traversal.status()).toBe(404);
});
