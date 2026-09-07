import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const valueAfter = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
const portValue = valueAfter('--port') ?? '4173';
const port = Number(portValue);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${portValue}. Use --port followed by a number from 1 to 65535.`); process.exit(1);
}
const applicationRoot = path.resolve(valueAfter('--root') ?? path.join(scriptDirectory, 'app'));
const rootPrefix = `${applicationRoot}${path.sep}`;

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.svg', 'image/svg+xml; charset=utf-8'], ['.png', 'image/png'], ['.ttf', 'font/ttf'], ['.woff2', 'font/woff2'], ['.task', 'application/octet-stream'],
]);

function safePath(urlValue) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(urlValue, 'http://127.0.0.1').pathname); }
  catch { return null; }
  if (pathname.includes('\0') || pathname.includes('\\')) return null;
  const normalized = path.posix.normalize(pathname).replace(/^\/+/, '');
  const candidate = path.resolve(applicationRoot, normalized || 'index.html');
  if (candidate !== applicationRoot && !candidate.startsWith(rootPrefix)) return null;
  return candidate;
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Method not allowed.'); return;
  }
  let target = safePath(request.url ?? '/');
  if (!target) { response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Invalid path.'); return; }
  try {
    const details = await stat(target);
    if (details.isDirectory()) target = path.join(target, 'index.html');
    const bytes = await readFile(target);
    const extension = path.extname(target).toLowerCase();
    const cacheControl = path.basename(target) === 'version-manifest.json' ? 'no-cache' : extension === '.html' ? 'no-cache' : 'public, max-age=3600';
    response.writeHead(200, { 'Content-Type': contentTypes.get(extension) ?? 'application/octet-stream', 'Content-Length': bytes.byteLength, 'Cache-Control': cacheControl, 'X-Content-Type-Options': 'nosniff' });
    if (request.method === 'HEAD') response.end(); else response.end(bytes);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found.');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') console.error(`Port ${port} is already in use. Close the other server or run: node server.mjs --port 4174`);
  else console.error(error.message);
  process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Love, Parametrically is available at http://127.0.0.1:${port}/`);
  console.log('Keep this terminal open while using the app. Press Ctrl+C to stop.');
});
