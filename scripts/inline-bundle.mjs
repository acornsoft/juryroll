import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'app', 'dist');
const indexPath = path.join(dist, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('base64');
}

function rewriteAssetUrls(code) {
  const next = code.replace(
    /new URL\(\s*(['"])(?!assets\/)([^'"]+\.(?:xlsx|csv))\1\s*,\s*import\.meta\.url\s*\)/g,
    (_, quote, name) => `new URL(${quote}assets/${name.replace(/^\.\//, '')}${quote}, import.meta.url)`,
  );
  const missed = next.match(/new URL\(\s*['"](?!assets\/)[^'"]+\.(?:xlsx|csv)['"]/g);
  if (missed) {
    throw new Error(`asset URL rewrite missed: ${missed.join(', ')}`);
  }
  return next;
}

const scriptHrefs = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"><\/script>/g)];
if (!scriptHrefs.length) throw new Error('built index has no module script');
const scripts = [];
for (const match of scriptHrefs) {
  const rel = match[1].replace(/^\.\//, '');
  const file = path.join(dist, rel);
  let code = fs.readFileSync(file, 'utf8');
  code = rewriteAssetUrls(code);
  code = code.replace(/<\/script/gi, '<\\/script');
  scripts.push(code);
  fs.unlinkSync(file);
  html = html.replace(match[0], '');
}
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');

const styleHrefs = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
const styles = [];
for (const match of styleHrefs) {
  const rel = match[1].replace(/^\.\//, '');
  const file = path.join(dist, rel);
  if (!fs.existsSync(file)) continue;
  const css = fs.readFileSync(file, 'utf8')
    .replace(/url\(\s*(['"]?)(?:\.\.\/|\/)?fonts\//g, 'url($1/fonts/')
    .replace(/<\/style/gi, '<\\/style');
  styles.push(css);
  fs.unlinkSync(file);
  html = html.replace(match[0], '');
}

const guidePath = path.join(dist, 'guide.html');
const guideCssPath = path.join(dist, 'guide.css');
const guideCss = fs.existsSync(guideCssPath) ? fs.readFileSync(guideCssPath, 'utf8') : '';

const scriptHashes = scripts.map((code) => `'sha256-${sha256(code)}'`);
const styleHashes = styles.map((code) => `'sha256-${sha256(code)}'`);
if (guideCss) styleHashes.push(`'sha256-${sha256(guideCss)}'`);

const csp = [
  "default-src 'none'",
  `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
  `style-src 'self' ${styleHashes.join(' ')}`.trim(),
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "worker-src 'none'",
].join('; ');

const styleTags = styles.map((code) => `<style>${code}</style>`).join('');
const scriptTags = scripts.map((code) => `<script type="module">${code}</script>`).join('');
html = html.replace('</head>', () => `${styleTags}<meta http-equiv="Content-Security-Policy" content="${csp}"></head>`);
html = html.replace('<div id="root">', () => `${scriptTags}<div id="root">`);
fs.writeFileSync(indexPath, html);

if (fs.existsSync(guidePath)) {
  let guide = fs.readFileSync(guidePath, 'utf8');
  guide = guide.replace('__CSP__', csp);
  if (guideCss && !guide.includes('<style>')) {
    guide = guide.replace('</head>', () => `<style>${guideCss.replace(/<\/style/gi, '<\\/style')}</style></head>`);
    guide = guide.replace(/<link rel="stylesheet"[^>]*>/, '');
  }
  fs.writeFileSync(guidePath, guide);
}

const configPath = path.join(dist, 'staticwebapp.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.globalHeaders['Content-Security-Policy'] = csp;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('inlined bundle');
console.log(csp);
