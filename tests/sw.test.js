import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

async function listFiles(dir) {
  const out = [];
  for (const ent of await readdir(join(root, dir), { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await listFiles(p)));
    else out.push(p);
  }
  return out;
}

test('service worker guarda todos os arquivos do app', async () => {
  const sw = await readFile(join(root, 'sw.js'), 'utf8');
  const list = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  const expected = ['./', './index.html', './manifest.webmanifest'];
  for (const dir of ['css', 'icons', 'js']) {
    for (const f of await listFiles(dir)) expected.push(`./${relative(root, join(root, f)).replace(/\\/g, '/')}`);
  }
  assert.deepEqual([...list].sort(), expected.sort());
});
