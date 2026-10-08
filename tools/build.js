// Baut zwei Einzeldatei-Versionen nach dist/ (alle Skripte eingebettet):
//  - epochenkrieg.html: vollständiges HTML-Dokument zum Weitergeben/Offline-Spielen
//  - artifact.html:     Seitenfragment für claude.ai-Artifacts (der Host ergänzt
//                       doctype/head/body selbst; <title> und <style> stehen oben)
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  return `<script>\n// ${src}\n${code.replace(/<\/script/gi, '<\\/script')}</script>`;
});

const pick = (re) => {
  const m = html.match(re);
  if (!m) throw new Error('Nicht gefunden: ' + re);
  return m[0];
};
const title = pick(/<title>[\s\S]*?<\/title>/);
const style = pick(/<style>[\s\S]*?<\/style>/);
const fonts = (html.match(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/g) || []).join('\n');
const body = pick(/<body>[\s\S]*<\/body>/)
  .replace(/^<body>/, '')
  .replace(/<\/body>$/, '');
const fragment = `${title}\n${style}\n${fonts}\n${body.trim()}\n`;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
for (const [name, content] of [
  ['epochenkrieg.html', html],
  ['artifact.html', fragment],
]) {
  const out = path.join(root, 'dist', name);
  fs.writeFileSync(out, content);
  console.log(`${path.relative(root, out)} geschrieben (${(content.length / 1024).toFixed(0)} KB)`);
}
