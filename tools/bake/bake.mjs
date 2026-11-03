// Bakes the game's art and audio into assets/ (run from the repo root):
//   node tools/bake/bake.mjs
// Needs Node, Playwright's Chromium and ffmpeg (music is stored as Ogg Vorbis).
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.addInitScript(src => { window.__audioSrc = src; }, readFileSync(root + '/tools/bake/audio.js', 'utf8'));
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto('file://' + root + '/tools/bake/bake.html');
await page.waitForFunction(() => document.title !== '', null, { timeout: 300000 });
const title = await page.title();
if (title !== 'ready') { console.error(title); process.exit(1); }
const out = await page.evaluate(() => window.bake);
await browser.close();

for (const [name, url] of Object.entries(out.images)) {
  const f = `${root}/assets/${name}.png`; mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
}
mkdirSync(`${root}/assets/audio`, { recursive: true });
for (const [name, b64] of Object.entries(out.audio)) {
  const wav = `${root}/assets/audio/${name}.wav`;
  writeFileSync(wav, Buffer.from(b64, 'base64'));
  if (name.startsWith('tune-')) {   // music -> Ogg Vorbis to keep the exe small
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '6', wav.replace('.wav', '.ogg')]);
    rmSync(wav);
  }
}
writeFileSync(`${root}/assets/audio/tunes.txt`, out.tuneNames.join('\n') + '\n');
console.log('baked', Object.keys(out.images).length, 'images and', Object.keys(out.audio).length, 'sounds');
