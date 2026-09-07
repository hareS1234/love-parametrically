import { build } from 'esbuild';

await build({
  entryPoints: ['src/vision/hand.worker.ts'],
  outfile: 'public/generated/hand-worker.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  legalComments: 'eof',
  sourcemap: false,
  minify: true,
});

console.log('Built public/generated/hand-worker.js');
