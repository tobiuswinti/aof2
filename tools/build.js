// Erzeugt dist/epochenkrieg.html: eine einzelne, eigenständige HTML-Datei
// (alle Skripte eingebettet) – praktisch zum Weitergeben oder Offline-Spielen.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  return `<script>\n// ${src}\n${code.replace(/<\/script/gi, '<\\/script')}</script>`;
});
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'epochenkrieg.html');
fs.writeFileSync(out, html);
console.log(`${path.relative(root, out)} geschrieben (${(html.length / 1024).toFixed(0)} KB)`);
