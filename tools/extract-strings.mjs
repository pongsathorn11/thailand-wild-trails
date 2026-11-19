// Pulls the Thai/English UI text out of the single-file prototype into JSON files,
// so the TypeScript game and the prototype share one set of strings during the port.
// Usage: npm run extract-strings
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const proto = resolve(here, '../../thailand-wild-trails/knowledge/game.html');
const html = readFileSync(proto, 'utf8');

const start = html.indexOf('const STR = {');
const end = html.indexOf('// 3. ASSETS');
if (start < 0 || end < 0) throw new Error('Could not find the STR block in the prototype');
// The block is plain object literals plus Object.assign(STR.xx, {...}) calls, with no other references.
const block = html.slice(start, end).replace(/\/\/ =+\s*$/, '');
const STR = new Function(`${block}; return STR;`)();

const outDir = resolve(here, '../src/i18n');
mkdirSync(outDir, { recursive: true });
for (const lang of Object.keys(STR)) {
  writeFileSync(resolve(outDir, `${lang}.json`), JSON.stringify(STR[lang], null, 2) + '\n', 'utf8');
  console.log(`${lang}: ${Object.keys(STR[lang]).length} strings`);
}
