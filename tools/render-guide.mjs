import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function assembleGuide(source) {
  const order = fs.readFileSync(path.join(root, 'shared/guide/order.txt'), 'utf8').trim().split('\n');
  const rows = order.map((code) => fs.readFileSync(path.join(root, 'shared/guide/rows', `${code}.md`), 'utf8').trim()).join('\n');
  const sections = order.flatMap((code) => {
    const file = path.join(root, 'shared/guide/sections', `${code}.md`);
    if (!fs.existsSync(file)) return [];
    const text = fs.readFileSync(file, 'utf8').trim();
    return text ? [text] : [];
  }).join('\n\n');
  return source
    .replace('<!-- state-rows -->', rows)
    .replace('<!-- state-sections -->', sections);
}

const md = assembleGuide(fs.readFileSync(path.join(root, 'shared', 'GUIDE.md'), 'utf8'));

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(lines[i]);
        i += 1;
      }
      const cells = (row) => row.split('|').slice(1, -1).map((cell) => cell.trim());
      const header = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push('<table><thead><tr>' + header.map((cell) => `<th>${inline(cell)}</th>`).join('') + '</tr></thead><tbody>');
      body.forEach((row) => {
        out.push('<tr>' + row.map((cell) => `<td>${inline(cell)}</td>`).join('') + '</tr>');
      });
      out.push('</tbody></table>');
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      out.push('<ul>');
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
        i += 1;
      }
      out.push('</ul>');
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      out.push('<ol>');
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
        i += 1;
      }
      out.push('</ol>');
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,3}\s/.test(lines[i]) && !lines[i].startsWith('|') && !/^[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

const body = markdownToHtml(md);
const copySrc = fs.readFileSync(path.join(root, 'shared/src/content/copy.ts'), 'utf8');
const bannerMatch = /export const DEMO_BANNER = '([^']*)'/.exec(copySrc);
if (!bannerMatch) throw new Error('DEMO_BANNER missing from copy.ts');
const demoBanner = bannerMatch[1];
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>JuryRoll: what you can do with a lead</title>
  <meta http-equiv="Content-Security-Policy" content="__CSP__">
  <link rel="stylesheet" href="./guide.css">
</head>
<body>
  <p class="demo-banner" role="region" aria-label="Site status">${demoBanner} <a href="./index.html#/disclaimer">Disclaimer</a></p>
  <main>
${body}
  </main>
  <p class="guide-disclaimer" id="footerDisclaimer"><a href="./index.html#/disclaimer">Disclaimer</a></p>
</body>
</html>
`;
const dest = path.join(root, 'app', 'public', 'guide.html');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, html);
console.log('guide.html');
