import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { zipSync } from 'fflate';

const execute = promisify(execFile);
const repositoryRoot = path.resolve(new URL('..', import.meta.url).pathname);
const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
await execute(process.execPath, [path.join(repositoryRoot, 'scripts/build-worker.mjs')], { cwd: repositoryRoot });
await execute(process.execPath, [path.join(repositoryRoot, 'scripts/verify-assets.mjs')], { cwd: repositoryRoot });
await execute(path.join(repositoryRoot, 'node_modules/.bin/vite'), ['build'], { cwd: repositoryRoot });

const stagingParent = await mkdtemp(path.join(os.tmpdir(), 'love-parametrically-release-'));
const releaseRoot = path.join(stagingParent, `love-parametrically-v${packageJson.version}`);
const appRoot = path.join(releaseRoot, 'app');
await mkdir(appRoot, { recursive: true });
await cp(path.join(repositoryRoot, 'dist'), appRoot, { recursive: true });
await cp(path.join(repositoryRoot, 'scripts/server.mjs'), path.join(releaseRoot, 'server.mjs'));
await cp(path.join(repositoryRoot, 'START_HERE.md'), path.join(releaseRoot, 'START_HERE.md'));
await cp(path.join(repositoryRoot, 'THIRD_PARTY_NOTICES.md'), path.join(releaseRoot, 'THIRD_PARTY_NOTICES.md'));
await cp(path.join(repositoryRoot, 'assets-manifest.json'), path.join(releaseRoot, 'assets-manifest.json'));

async function filesBelow(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true }); const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.posix.join(prefix, entry.name); const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesBelow(absolute, relative)); else result.push({ relative, absolute });
  }
  return result;
}
const files = await filesBelow(releaseRoot);
const checksums = [];
for (const file of files) checksums.push(`${createHash('sha256').update(await readFile(file.absolute)).digest('hex')}  ${file.relative}`);
await writeFile(path.join(releaseRoot, 'ASSET_CHECKSUMS.txt'), `${checksums.join('\n')}\n`);

const zipEntries = {};
for (const file of await filesBelow(releaseRoot)) zipEntries[`${path.basename(releaseRoot)}/${file.relative}`] = new Uint8Array(await readFile(file.absolute));
const archiveName = `love-parametrically-v${packageJson.version}.zip`;
const archivePath = path.join(repositoryRoot, archiveName);
await writeFile(archivePath, zipSync(zipEntries, { level: 9 }));
const bytes = (await stat(archivePath)).size;
await rm(stagingParent, { recursive: true, force: true });
console.log(`Created ${archiveName} (${(bytes / 1024 / 1024).toFixed(2)} MiB).`);
