import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../assets-manifest.json', import.meta.url), 'utf8'));
let failed = false;
for (const asset of manifest.assets) {
  const file = new URL(`../public/${asset.path}`, import.meta.url);
  try {
    const bytes = await readFile(file);
    const details = await stat(file);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (details.size !== asset.bytes || digest !== asset.sha256) {
      console.error(`Mismatch: ${asset.path}`); failed = true;
    }
  } catch {
    console.error(`Missing: ${asset.path}`); failed = true;
  }
}
if (failed) process.exit(1);
console.log(`Verified ${manifest.assets.length} local runtime assets.`);
