#!/usr/bin/env node
// Re-embeds tax-rules.json into index.html so the app works even when fetch is blocked (offline / file://).
// Run after every rules change: node scripts/embed-rules.js
const fs = require('fs');
const rules = JSON.parse(fs.readFileSync('tax-rules.json', 'utf8'));
let html = fs.readFileSync('index.html', 'utf8');
const payload = JSON.stringify(rules).replace(/<\//g, '<\\/');
const re = /window\.RUPEEZERO_BUNDLED_RULES = [\s\S]*?;\n/;
if (!re.test(html)) { console.error('Could not find bundled-rules placeholder in index.html'); process.exit(1); }
html = html.replace(re, `window.RUPEEZERO_BUNDLED_RULES = ${payload};\n`);
fs.writeFileSync('index.html', html);
console.log('Embedded rules (updated ' + rules.updated + ') into index.html');
